/****************************************************************************************
   < Todoist Watchapp >

The authentication key (API key) can be found on Todoist website > settings > Integration
*****************************************************************************************/
var config = require('./config.json');

const APIURL = "https://api.todoist.com/rest/v2/";
const TIMELINEURL = "https://timeline-api.rebble.io/v1/user/pins/";

var UI = require('ui');
var ajax = require('ajax');
var Voice = require('ui/voice');
var v_lst_od = []; // List of overdue's tasks
var v_lst_to = []; // List of today's tasks

var v_menu = new UI.Menu({
    backgroundColor: 'black',
    textColor: 'white',
    highlightBackgroundColor: '#c5cacf',
    highlightTextColor: 'black'
});

v_menu.on('select', function (e) {
    open(e.sectionIndex, e.itemIndex);
});

// Helper to convert ajax to promises
function ajaxPromise(options) {
    return new Promise((resolve, reject) => {
        ajax(options, resolve, reject);
    });
}

function show_error(message) {
    var errorCard = new UI.Card({
        title: 'Erreur',
        titleColor: 'red',
        body: message
    });
    errorCard.show();
}

async function refresh() {
    // Clear existing sections
    v_menu.section(1, { items: [] }); // Overdue tasks
    v_menu.section(2, { items: [] }); // Today's tasks

    try {
        // Fetch overdue tasks
        const overdueResponse = await ajaxPromise({
            url: `${APIURL}tasks?filter=overdue`,
            headers: { "Authorization": `Bearer ${config.APIKEY}` }
        });
        v_lst_od = JSON.parse(overdueResponse);
        const overdueItems = v_lst_od.map(task => ({ title: task.content }));
        v_menu.section(1, {
            title: `En retard: ${v_lst_od.length}`,
            backgroundColor: 'red',
            items: overdueItems
        });
    } catch (error) {
        show_error('Erreur lors du chargement des tâches en retard.');
    }

    try {
        // Fetch today's tasks
        const todayResponse = await ajaxPromise({
            url: `${APIURL}tasks?filter=today`,
            headers: { "Authorization": `Bearer ${config.APIKEY}` }
        });
        v_lst_to = JSON.parse(todayResponse);

        // Add custom sort field for tasks
        v_lst_to.forEach(task => {
            task.due.orderdate = task.due.hasOwnProperty('datetime')
                ? task.due.datetime
                : `${task.due.date}T22:59:59Z`;
        });

        v_lst_to.sort((a, b) => new Date(a.due.orderdate) - new Date(b.due.orderdate));
        const todayItems = v_lst_to.map(task => ({ title: task.content }));

        v_menu.section(2, {
            title: `Aujourd'hui: ${v_lst_to.length}`,
            backgroundColor: '#37a611',
            items: todayItems
        });
    } catch (error) {
        show_error('Erreur lors du chargement des tâches du jour.');
    }
}

async function open(sectionIndex, itemIndex) {
    if (sectionIndex === 0) {
        add();
        return;
    }

    const selectedTask = sectionIndex === 1 ? v_lst_od[itemIndex] : v_lst_to[itemIndex];

    const currentCard = new UI.Card({
        title: selectedTask.content,
        scrollable: true
    });

    // Ajoutez l'action "valider" (flèche de sélection)
    currentCard.action({
        select: 'ACTION_SELECT' // Icône par défaut pour valider
    });

    // Action pour fermer la tâche lorsque l'utilisateur appuie sur "select"
    currentCard.on('click', 'select', async function () {
        try {
            await ajaxPromise({
                url: `${APIURL}tasks/${selectedTask.id}/close`,
                method: 'post',
                headers: { "Authorization": `Bearer ${config.APIKEY}` }
            });

            // Mise à jour des listes locales
            if (sectionIndex === 1) {
                v_lst_od = v_lst_od.filter(task => task.id !== selectedTask.id);
            } else {
                v_lst_to = v_lst_to.filter(task => task.id !== selectedTask.id);
            }

            // Rafraîchir l'interface utilisateur
            await refresh();
            currentCard.hide();
        } catch (error) {
            show_error('Erreur lors de la fermeture de la tâche.');
        }
    });

    currentCard.show();
}

async function add() {
    Voice.dictate('start', true, async function (e) {
        if (e.err) {
            show_error(e.err);
            return;
        }

        const transcription = e.transcription;
        const requestData = { content: transcription };

        try {
            await ajaxPromise({
                url: `${APIURL}tasks`,
                method: 'post',
                type: 'text',
                data: JSON.stringify(requestData),
                headers: {
                    "Content-Type": "application/json",
                    "X-Request-Id": uuidv4(),
                    "Authorization": `Bearer ${config.APIKEY}`
                }
            });
            await refresh();
        } catch (error) {
            show_error('Erreur lors de l\'ajout de la tâche.');
        }
    });
}

function init() {
    const splashScreen = new UI.Card({
        title: 'Todoist',
        banner: 'IMAGE_MENU_ICON',
        backgroundColor: 'black'
    });
    splashScreen.show();

    refresh().then(() => {
        setTimeout(() => {
            v_menu.show();
            splashScreen.hide();
        }, 400);
    });
}

// Generate uuidv4 for X-Request-Id
function uuidv4() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
        var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

init();
