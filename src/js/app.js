/****************************************************************************************
   < Todoist Watchapp >

The authentication key (API key) can be found on Todoist website > settings > Integration
*****************************************************************************************/
var config = require( './config.json' );

const APIURL      = "https://api.todoist.com/rest/v1/";
const TIMELINEURL = "https://timeline-api.rebble.io/v1/user/pins/";
 
var UI       = require( 'ui' );
var ajax     = require( 'ajax' );
var Voice    = require( 'ui/voice' );
var v_lst_od = [];  // List of overdue's tasks
var v_lst_to = [];  // List of today's tasks

var v_menu = new UI.Menu({
    backgroundColor:            'black',
    textColor:                  'white',
    highlightBackgroundColor:   '#c5cacf',
    highlightTextColor:         'black'
});

v_menu.on( 'select', function( e ) {
    open( e.sectionIndex, e.itemIndex );
});

function addZero( i ) {
    if( i < 10 )
        i = "0" + i;

    return i;
}

// Generate uuidv4 for X-Request-Id
function uuidv4() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function( c ) {
    var r = Math.random() * 16 | 0, v = c == 'x' ? r : ( r & 0x3 | 0x8 );
    return v.toString( 16 );
  });
}

function show_error( pi_texte ) {
    var v_err = new UI.Card({
        title:           'Erreur\n\n',
        titleColor:      'red',
        body:            pi_texte
    });

    v_err.show();
}

function extract_duetime( pi_texte ) {

    // à xxhxx
    var v_patt = new RegExp( "[aà]? [0-9]{1,2}h[0-9]{1,2}" );
    var v_time = v_patt.exec( pi_texte );
    if( v_time !== null )
        return v_time;

    // à xxh
    v_patt = new RegExp( "[aà]? [0-9]{1,2}h" );
    v_time = v_patt.exec( pi_texte );
    if( v_time !== null )
        return v_time;

    // à xx heures
    v_patt = new RegExp( "[aà]? [0-9]{1,2} (heure)s?" );
    v_time = v_patt.exec( pi_texte );
    if( v_time !== null )
        return v_time;

    v_patt = new RegExp( "[aà]? (un|une|deux|trois|quatre|cinq|six|sept|huit|neuf) (heure)s?" );
    v_time = v_patt.exec( pi_texte );
    if( v_time !== null )
        return v_time;

    v_patt = new RegExp( "[aà]? (midi)" );
    v_time = v_patt.exec( pi_texte );
    if( v_time !== null )
        return v_time;

    return "";
}

function extract_duedate( pi_texte ) {
    v_patt = new RegExp( "(le)? [0-9]{1,2} (janvier|février|mars|avril|mai|juin|juillet|août|septembre|octobre|novembre|décembre) ?([0-9]{4})?" );
    v_date = v_patt.exec( pi_texte );
    if( v_date !== null )
        return v_date;

    v_patt = new RegExp( "(aujourd'hui|demain|lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche)" );
    v_date = v_patt.exec( pi_texte );
    if( v_date !== null )
        return v_date;

    return "";
}

function add() {

    Voice.dictate( 'start', true, function( e ) {
        if( e.err ) {
            show_error( e.err );
            return;
        }

        var v_str = e.transcription;

        // Extract hours
        var v_time = extract_duetime( v_str );
        if( v_time !== "" ) {
            v_time = v_time.toString().split( "," )[0];
            v_str = v_str.replace( v_time, "" );
        }

        // Extract date
        var v_date = extract_duedate( v_str );
        if( v_date !== "" ) {
    	    v_date = v_date.toString().split( "," )[0];
            v_str  = v_str.replace( v_date, "" );
        }

        if( v_date !== "" || v_time !== "" ) {
            v_data = JSON.stringify({
                "content": v_str.toString(),
                "due_string": v_date.toString() + " " + v_time.toString()
            });
        } else {
            v_data = JSON.stringify({
                "content": v_str.toString()
            });
        }


        ajax({
	          url: APIURL + 'tasks',
	          method: 'post',
	          type: 'text',
	          data: v_data, 
	          headers: {
	    	        "Content-Type": "application/json",
	    	        "X-Request-Id": uuidv4(),
	    	        "Authorization": "Bearer " + config.APIKEY
	          }},
	      function( data ) {
	          refresh();
	      },
	      function( error ) {
	    	    show_error( error );
	      }
	    );
    });
}

function open( pi_section, pi_index ) {
    if( pi_section == 0 ) {
    	add();
      return;
    }

    var v_task  = [];
    if( pi_section == 1 && v_lst_od.length > 0 )
        v_task = v_lst_od[pi_index];
    else
	      v_task = v_lst_to[pi_index];

    var v_subt = "";
    if( v_task.due.hasOwnProperty( 'datetime' ) ) {
        var v_date = new Date( v_task.due.datetime );

	      v_subt = addZero( v_date.getHours() ) + ":" + addZero( v_date.getMinutes() );
    }

    var v_current = new UI.Card({
	     title:           v_task.content,
	     subtitle:        v_subt,
	     scrollable:      true
    });

    // Hack : if v_body build before, the text don't display
    if( v_task.comment_count > 0 ) {
        ajax({
	         url: APIURL + 'comments?task_id=' + v_task.id,
	         headers: {
		           "Authorization": "Bearer " + config.APIKEY
	         }},
	         function( data ) {
	            var v_data = JSON.parse( data );

	            var v_body = "\n";
	            if( v_data.length > 0 ) {
	               for( var i = 0; i < v_data.length; i++ ) {
	                   v_body += v_data[i].content;
	                   if( i < v_data.length - 1)
	                       v_body += "\n\n";
	               }
	            }

	            v_current.body( v_body );
	          }
	      );
    }

    v_current.action({
        select: 'ACTION_SELECT'
    });

    // Close task
    v_current.on('click', 'select', function() {
        ajax({
            url: APIURL + 'tasks/' + v_task.id + '/close',
	    method: 'post',
	    headers: {
	        "Authorization": "Bearer " + config.APIKEY
	    }},
	    function( data ) {
            // Remove on timeline
            if( config.TIMELINE_TOKEN != "" ) {
                var today = new Date();
                var id    = "todoist-" + today.getFullYear();
               
                if( today.getMonth() + 1 < 10 )
                    id += "0";
                id += today.getMonth() + 1;

                if( today.getDay() < 10 )
                    id += "0";
                id += today.getDate(); 
                id += "-" + v_task.id;

                ajax({
                    url: TIMELINEURL + id,
                    method: 'delete',
                    headers: {
                        "Content-Type": "application/json",
                        "X-User-Token": config.TIMELINE_TOKEN
                    }     
                });
            }

	        refresh();
	        v_current.hide();
	    }
        );
    });

    v_current.show();
}

// Sort today's task by due time
function custom_sort(a, b) {
    return new Date(a.due.orderdate).getTime() - new Date(b.due.orderdate).getTime();
}

function refresh() {

    // Add task
    var v_section = {
        items: [{
            title: 'Ajouter',
            icon:  'MENU_ADD'
        }]
    };
    v_menu.section(0, v_section);

    // List overdue
    ajax({
        url: APIURL + 'tasks?filter=overdue',
        headers: {
    	    "Authorization": "Bearer " + config.APIKEY
        }},
        function( data ) {
            v_lst_od = JSON.parse( data );

            if( v_lst_od.length > 0 ) {
                var v_items = [];
                for( var i = 0; i < v_lst_od.length; i++ ) {
                    v_items.push( { title: v_lst_od[i].content });
                }

                var v_section = {
                    title: 'En retard: ' + v_lst_od.length,
                    backgroundColor: 'red',
                    items: v_items
                };
            }

            v_menu.section(1, v_section);
            v_menu.selection(1, 0);     // Query async, select first item of this section
        }
    );

    // List today
    ajax({
        url: APIURL + 'tasks?filter=today',
        headers: {
            "Authorization": "Bearer " + config.APIKEY
        }},
        function( data ) {
            v_lst_to = JSON.parse( data );

            // Add a custom field for sort (datetime not already exist)
            for( var i = 0; i < v_lst_to.length; i++ ) {
                if( v_lst_to[i].due.hasOwnProperty( 'datetime' ) )
                    v_lst_to[i].due.orderdate = v_lst_to[i].due.datetime;
                else
                    v_lst_to[i].due.orderdate = v_lst_to[i].due.date + "T22:59:59Z";
            }
            v_lst_to.sort(custom_sort);

            if( v_lst_to.length > 0 ) {
                var v_items = [];
                for( var i = 0; i < v_lst_to.length; i++ ) {
                    if( v_lst_to[i].due.hasOwnProperty( 'datetime' ) ) {
                        var v_date = new Date(v_lst_to[i].due.datetime);

                        v_items.push( { title: v_lst_to[i].content, subtitle: addZero( v_date.getHours() ) + ":" + addZero( v_date.getMinutes() ) });
                    } else
                        v_items.push( { title: v_lst_to[i].content });
                }

                var v_section = {
                    title: 'Aujourd\'hui: ' + v_lst_to.length,
                    backgroundColor: '#37a611',
                    items: v_items
                };
            }

            v_menu.section(2, v_section);
        }
    );
}

function init() {

    var v_splashScreen = new UI.Card({
        title:           'Todoist\n\n',
        titleColor:      'red',
        banner:          'IMAGE_MENU_ICON',
        backgroundColor: 'black'
    });
    v_splashScreen.show();

    refresh();

    setTimeout(function() {
        v_menu.show();
        v_splashScreen.hide();
    }, 400);
}

init();
