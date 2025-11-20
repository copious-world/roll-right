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

let html_start_doc_head = `
<!doctype html>
<html>
<head>
`

let base_patterns = {

    "html" : {
        "start_doc_head" : html_start_doc_head
    }
}

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
 * This class is made for organizing the code in this utility.
 * 
 * 
 * 
 * 
 */
class SkelToTemplate {

    /**
     * 
     * Takes in the configuration object, which describes which files are to be loaded as skeletons
     * and which files are to be output to the directories of concerns.
     * 
     * The constructor calls upon the PathManager obect to expand out a set of abbreviations used
     * for file names in the skeleton processing.
     * 
     * Default directories for finding types of file are expanded to absolute paths and placed in their maps.
     * Top level directories, those with special keys (part of the skeleton language) are expanded as well.
     * 
     * @param {object} conf 
     */
    constructor(conf) {
        //
        this.paths = null
        if ( typeof conf.inputs  === 'object' ) {
            this.paths = new PathManager(conf.inputs)
        }
        //
        this.ext_default_dirs = Object.assign({},conf.ext_default_dirs)
        this.top_dir_locations =  Object.assign({},conf.top_dir_locations)
        //
        this.created_dir = conf['@target']   // will often appear in the top level of project directory
        if ( typeof this.created_dir !== 'string' ) {
            let msg = "missging terminal (leaf) dir name in field '@target'"
            console.log(msg)
            throw new Error(msg)
        }
        //
        // expand the directories
        // these directories are assumed to exist
        let ext_default_dir = this.ext_default_dirs
        let top_dir_locations = this.top_dir_locations

        for ( let [ext,edd] of Object.entries(ext_default_dir) ) {
            let edd_path = this.paths.compile_one_path(edd)
            ext_default_dir[ext] = edd_path
        }
        //
        for ( let [script_key,tdl] of Object.entries(top_dir_locations) ) {
            let tdl_path = this.paths.compile_one_path(tdl)
            top_dir_locations[script_key] = tdl_path
        }
        //
        this.outputs = false
        let outputs = conf.outputs
        if ( outputs && Array.isArray(outputs) ) {
            for ( let ogroup of outputs ) {
                let targets = ogroup.targets // targets
                if ( typeof targets !== 'object' || Array.isArray(targets) ) {
                    let msg = "each output group in the 'output' array is expected to have a map 'targets' specifying asset name to asset directory"
                    console.log(msg)
                    throw new Error(msg)
                }
                let skeletons = ogroup.skeletons  // skeletons
                if ( typeof skeletons !== 'object' || Array.isArray(skeletons) ) {
                    let msg = "each output group in the 'output' array is expected to have a map 'skeletons' specifying termplace file names to source skeletons"
                    console.log(msg)
                    throw new Error(msg)
                }
            }
            this.outputs = outputs
        }
    }



    /**
     * 
     * @param {object} targets - a set of directory 
     * @param {object} skeletons - a map of skeletons path names to skeleton forms to be expanded
     * @param {string} created_dir - the leaf directory to be created
     */
    async ensure_all_concerns_template_directories(targets,skeletons) {
        //
        let dir_form = targets.dir_form
        let concerns = targets.concerns
        //
        dir_form = dir_form.replace("@target",this.created_dir)
        //
        // Here, the directories which will receive template copies for an 
        // asset stack will be created if they do not exists.
        for ( let concern of concerns ) {
            //
            let top_out_dir = dir_form.replace("@concern",concern)
            //
            let promises = []
            for ( let [opath,skeleton] of Object.entries(skeletons) ) {
                let skel_output_path = `${top_out_dir}${opath}`
                console.log(skel_output_path," => ",skeleton)
                let sk_path = this.paths.compile_one_path(skel_output_path)
                console.log(sk_path)
                promises.push(fos.ensure_directories(sk_path,"",true)) 
            }
            await Promise.all(promises)
            //
        }
        //
    }


    /**
     * makes sure that directories receiving the generated assets exists 
     * and are structure according to the configuration.
     * 
     * 
    */
    async prepare_directories() {
        //
        let outputs = this.outputs
        for ( let ogroup of outputs ) {
            let targets = ogroup.targets // targets
            let skeletons = ogroup.skeletons  // skeletons
            await this.ensure_all_concerns_template_directories(targets,skeletons)
        }
    }


    /**
     * 
     * Loads the skeleton files. Creates a map from output names to skeleton source names.
     * Returs the map.
     * 
     * @returns object
    */
    async load_skeletons() {
        //
        let outputs = this.outputs
        let all_skeletons = {}
        //
        for ( let ogroup of outputs ) {
            let skeletons = ogroup.skeletons  // skeletons
            //
            for ( let file of Object.values(skeletons) ) {
                let fpath = this.paths.compile_one_path(file)
                let p = all_skeletons[fpath]
                all_skeletons[fpath] = p ? 1 : p + 1;
            }
        }

        let data_promises = []
        let skel_keys = Object.keys(all_skeletons)
        for ( let fpath of skel_keys ) {
            data_promises.push(fos.load_data_at_path(fpath))
        }
        let data_list = await Promise.all(data_promises)
        let n = data_list.length
        //
        for ( let i = 0; i < n; i++ ) {
            all_skeletons[skel_keys[i]] = data_list[i]
        }
        //
        return all_skeletons
    }


    /**
     * 
     * The one parameter `all_skeletons` is a map from file names to skeleton ascii.
     * 
     * This method parses the skeleton ascii, managing the document structure, 
     * creating lists of leaf files specified in the text and extracting skeleton files
     * in order to add them to the map `all_skeletons`.
     * 
     * Skeletons are parsed into sections. HTML structure is permitted in a skeleton.
     * Variables are allowed as $$<variable name> forms, where <variable name> is an identifier.
     * 
     * 
     * @param {object} all_skeletons
     */
    async skeleton_parsing(all_skeletons) {

    }



    /**
     * 
     * load the skeletons identified in the top level configuration.
     * Use `load_skeletons` to get the files and a list of output keys (file names)
     * which will be the templates stored with the concerns.
     * 
     * The `out_name_list` will be a list whose index elements correspond to the index
     * of output objects in the configure `output` object. a list of concerns can be found
     * in the targets field of one of the output objects. For each conern the skeletons 
     * they require will be gathered.
     * 
     * During the process of gathering, skeletons per concern, the keleton unification process 
     * will look recursively for skeleton components of higher level files and add them to the list
     * of skeletons per concern.
     * 
     * The `skeleton_unification` method may coallese imports of JavaScript into directories meant to be
     * targeted by bundlers. (Some source code is destined to the web page.)
     * 
     */ 
    async skeleton_unification() {
        //
        let all_skeletons = await this.load_skeletons()
        //
        console.log(Object.keys(all_skeletons))
        await this.skeleton_parsing(all_skeletons)
    }

    async generate_all_concerns_templates() {

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
    //
 
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
                let generator = args.generator  // a string
                console.log("Using input configuration for generator:\t\t",generator)
                //
                let conf = await fos.load_json_data_at_path(generator)
                if ( conf ) {
                    let to_templates = new SkelToTemplate(conf)
                    await to_templates.prepare_directories()
                    await to_templates.skeleton_unification()
                    //await to_templates.generate_all_concerns_templates()
                }
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