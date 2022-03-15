#!/usr/bin/env node

const papa = require('../index.js')
const {load_json_file} = require('../lib/utils')

const {transfer_node_module_browser_version} = require('../lib/rr_utils')
const {transfer_github_browser_version} = require('../lib/rr_utils')
const {transfer_local_directory_browser_version} = require('../lib/rr_utils')



let g_source_dir = process.argv[2]
if ( g_source_dir === undefined ) {
    g_source_dir = "."
}


function load_config(cf_name) {
    let path = g_source_dir + '/' + cf_name
    return load_json_file(path)
}


const g_config = load_config("roll-right.json")
papa.identify_me()
read_data(g_config)

// // 
function read_data(roll_conf) {
    try {
        console.dir(roll_conf)
        for ( let ky in roll_conf ) {
            let source_spec = roll_conf[ky]
            let kys = Object.keys(source_spec)
            if ( kys.length ) {
                switch ( ky ) {
                    case "pnpm" : {
                        transfer_node_module_browser_version(source_spec)
                        break
                    }
                    case "github" : {
                        transfer_github_browser_version(source_spec)
                        break
                    }
                    case "local" : {
                        transfer_local_directory_browser_version(source_spec)
                        break;
                    }
                    default: {
                        // plugins
                        break;
                    }

                }
            }
        }
    } catch (e) {
        console.log(e)
    }
}


