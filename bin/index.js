#!/usr/bin/env node

const fos = require('extra-file-class')()
const {PathManager} = require('extra-file-class')

const {transfer_node_module_browser_version} = require('../lib/rr_utils')
const {transfer_github_browser_version} = require('../lib/rr_utils')
const {transfer_local_directory_browser_version} = require('../lib/rr_utils')
const {port_modules} = require('../lib/mod_utils')

const Phase1 = require('../lib/phase1')
const Phase2 = require('../lib/phase2')
//
//

var g_argv = require('minimist')(process.argv.slice(2));

//
//
async function load_config(cf_name) {
    let path = g_source_dir + '/' + cf_name
    return await fos.load_json_data_at_path(path)
}

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
                        transfer_github_bro[skeletons]/wser_version(source_spec)
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


async function command_line_operations() {
    console.log("command line operations")

    g_config = await load_config("roll-right.json")

    if ( g_argv.phase ) {
        console.log(`starting phase ${g_argv.phase} instantiation`)
        switch ( g_argv.phase ) {
            case "template" :
            case 1: {                       /// creates templates
                if ( typeof g_config.alpha === "string" ) {
                    g_config.alpha = fos.load_json_data_at_path(g_config.alpha) // ALPHA
                }
                let ph1 = new Phase1(g_target,g_config.alpha)       // g_target <- args[0] ... g_config <- read <- g_source_dir <- args[1] 
                ph1.run()
                break
            }
            case "page":
            case 2: {
                if ( typeof g_config.beta === "string" ) {
                    g_config.beta = fos.load_json_data_at_path(g_config.beta)   // BETA 
                }
                let ph2 = new Phase2(g_target,g_config.beta)        // g_target <- args[0] ... g_config <- read <- g_source_dir <- args[1] 
                ph2.run()
                break
            }
            default : {
                console.log("unnown phase")
                break;
            }
        }
    }
    if ( g_argv.gather ) {  // about moving files to directories for node module, browser modules, etc.
        if ( typeof g_config.gather === "string" ) {
            g_config.modules = fos.load_json_data_at_path(g_config.gather)
        }
        read_data(g_config.gather)
    }
    if ( g_argv.modules ) {  // transforms and then copies base alpha code to final publication directores (npm is the only case yet)
        if ( typeof g_config.modules === "string" ) {
            g_config.modules = fos.load_json_data_at_path(g_config.modules)
        }
        port_modules(g_config.modules,g_argv)
    }

}


/**
 * 
 * @param {string} generator
 * 
 * @returns Promise<undefined>
 */
async function generate_all_configured_templates(generator) {
    //
    let conf = await fos.load_json_data_at_path(generator)
    if ( conf ) {
        //
        let paths = null
        if ( typeof conf.inputs  === 'object' ) {
            paths = new PathManager(conf.inputs)
        }

        let created_dir = conf['@target']
        if ( typeof created_dir !== 'string' ) {
            console.log("missging terminal (leaf) dir name in field '@target'")
            return 1
        }
        let outputs = conf.outputs
        if ( outputs && Array.isArray(outputs) ) {
            for ( let ogroup of outputs ) {
                let targets = ogroup.targets // targets
                if ( typeof targets !== 'object' || Array.isArray(targets) ) {
                    console.log("each output group in the 'output' array is expected to have a map 'targets' specifying asset name to asset directory" )
                    return 1
                }
                let skeletons = ogroup.skeletons  // skeletons
                if ( typeof skeletons !== 'object' || Array.isArray(skeletons) ) {
                    console.log("each output group in the 'output' array is expected to have a map 'skeletons' specifying termplace file names to source skeletons" )
                    return 1
                }
                let out_name_to_data = {}
                for ( let [o_name,file] of Object.entries(skeletons) ) {
                    let fpath = paths.compile_one_path(file)
                    out_name_to_data[o_name] = await fos.load_data_at_path(fpath)
                }
                //
                for ( let [target,directory] of Object.entries(targets) ) {
                    console.log(target,`${directory}${created_dir}`)
                    let top_out_dir = `${directory}${created_dir}`
                    for ( let [opath,skeleton] of Object.entries(skeletons) ) {
                        let skel_output_path = `${top_out_dir}${opath}`
                        console.log(skel_output_path," => ",skeleton)
                        let sk_path = paths.compile_one_path(skel_output_path)
                        console.log(sk_path)
                        await fos.ensure_directories(sk_path,"",true)
                    }
                }
            }
        } else {
            console.log("Expected an array of output descriptors in field 'output'")
        }
    }
    //
}


async function generate_all_templated_website_and_apps(substitutions) {
    
}




async function command_line_operations_new(args) {
    let phase = args.phase
    //
    if ( phase ) {
        //
        console.log("Operating phase:\t\t\t\t\t", phase)
        switch ( g_argv.phase ) {
            case "template" :
            case 1: {                       /// creates templates
                let generator = args.generator
                console.log("Using input configuration for generator:\t\t",generator)
                //
                await generate_all_configured_templates(generator)
                //
                break
            }
            case "page":
            case "assign":
            case 2: {
                let substitutions = args.values
                console.log("Using input configuration for assignments:\t\t",substitutions)
                 //
                await generate_all_templated_website_and_apps(substitutions)
                //
                break
            }
            default : {
                console.log("unnown phase")
                break;
            }
        }
        //
    }

            

    if ( phase === "template" ) {
    } else if ( phase === "assign" ) {
    }
    console.log("-------------------------------------------------------------")

}


console.log("-------------------------------------------------------------")
console.log("roll-right static content management and module publication")
console.log("-------------------------------------------------------------")

// command_line_operations()


command_line_operations_new(g_argv)