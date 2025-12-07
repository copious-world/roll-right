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


const TESTING = true

const {base_patterns_mod} = require('../lib/html_directives')
const crypto = require('crypto')


// needs module
let parse_util = {
    clear_comments : (str) => {
        if ( str.indexOf("verbatim::") === 0 ) {
            let check_end = str.lastIndexOf('}')
            //
            if ( check_end > 0 ) {
                let front = str.substring(0,check_end+1)
                return front
            }
        } else {
            if ( str.indexOf("//") >= 0 ) {
                let lines = str.split('\n')
                let n = lines.length
                for ( let i = 0; i < n; i++ ) {
                    let line = lines[i]
                    line = line.trim()
                    if ( line.length && (line.indexOf('//') === 0) ) {
                        lines[i] = ""
                    } else if ( line.length && (line.indexOf('//') > 0) ) {
                        line = line.substring(0,(line.indexOf('//'))).trim()
                        lines[i] = line
                    }
                }
                lines = lines.filter((line) => {
                    return line.length > 0
                })
                return lines.join("\n")
            }
        }
        return str.trim()
    },
    remove_spaces: (str)=> {
        let strs = str.split(' ')
        strs = strs.filter((sub) => {
            return sub.length > 0
        })
        return strs.join('')
    },
    remove_white: (str)=> {
        str = str.replace(/\s+/g,'')
        return str
    },
    flatten : (data_parts) => {
        let flattened = []
        for ( let part of data_parts ) {
            if ( typeof part === "string" ) {
                flattened.push(part)
            } else {
                let parted = parse_util.flatten(part)
                for ( let p of parted ) {
                    flattened.push(p)
                }
            }
        }
        return flattened
    },
    subst : (str,ky,val) => {
        while ( str.indexOf(ky) >= 0 ) {
            str = str.replace(ky,val)
        }
        return str
    },
    extract_var : (str) => {
        let var_up = str.substring(str.indexOf('@{') + 2)
        let vname = var_up.substring(0,var_up.indexOf('}'))
        return vname
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
        this.global_variable_values = conf.global_variable_values ? conf.global_variable_values : {}
        this.vars_unset_in_run = {}
        //
        this.top_level_parsed = conf.top_level_parsed
        //
        this.ext_default_dirs = Object.assign({},conf.ext_default_dirs)
        this.top_dir_locations =  Object.assign({},conf.top_dir_locations)
        this.find_concerns = Object.assign({},conf["use_case<[targets.dir]>"])
        this.target_dir_key = "targets.dir"
        this.find_in_group = {
            "targets.dir" : (obj) => obj.targets.dir
        }
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
            outputs = JSON.parse(JSON.stringify(outputs))
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

        this.range_pattern = new RegExp(/.*\<(\d),(\d+)\>\<\</)
        this.list_pattern = new RegExp(/.*\<(\w+)\>\<\</)
        //
        this.var_spec_pattern = new RegExp(/^\$\@\{(\w+)\}\$files\:\:(.*)$/)
        this.cross_type_directory = new RegExp(/^(\w+)\<(\w+)\>\:\:(.*)$/)
        this.executable_pattern = new RegExp(/\>\>.*\<\</)
        this.entry_starter = new RegExp(/^(\w+)\:\:/)
        this.sibling_type_directory_match = new RegExp(/^\[([\w-]+)\]\/(.*)$/)

        this.concerns_directory_redirect_match = new RegExp(/^\[(([\w-]+)\<([\w]+)\>)\]\/(.*)$/)

        this.start_of_list = new RegExp(/^\@list\<(\w+)\>\<\{/)

        this.ternary_check = new RegExp(/^(.+)\?(.+)\:(.*)/)
        this.var_pattern = new RegExp(/\@\{(\w+)\}/g)
        this.var_set_expr_pattern = new RegExp(/\{([\w\=\+\-\d]+)\}/)

        this.basic_function_call_match = new RegExp(/f\@(\w[\w\d]*)\{(\w[\w\d]*)\}/)

        this.entry_remap_map = {
            "files" : { "source" : "html", "type" : "tmplt"},
            "css" : { "source" : "css", "type" : "css"}
        }

        this.name_drops_db = {}
        //
        this.delay_file_loading_queue = []

    }


    /**
     * 
     * @param {string} entry_directive 
     * @returns {pair} - a two element array with ary[0] being the true directory name and ary[1] being the file type (extension)
     */
    entry_directive_location_remap(entry_directive) {
        let remap = this.entry_remap_map[entry_directive]
        if ( remap ) {
            return Object.values(remap)
        }
        return [entry_directive,entry_directive]
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
                let sko_path = this.paths.compile_one_path(skel_output_path)
                let sk_path = this.paths.compile_one_path(skeleton)
                skeletons[opath] = sk_path
                promises.push(fos.ensure_directories(sko_path,"",true)) 
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
     * Returns the map.
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
            for ( let [fky,file] of Object.entries(skeletons) ) {
                let fpath = this.paths.compile_one_path(file)
                let p = all_skeletons[fpath]
                let concerns = {} 
                let tdir = ogroup.targets.dir
                for ( let crn of ogroup.targets.concerns ) {
                    let crn_tdir = tdir.replace("@concern",crn)
                    concerns[crn] = {
                        usages: [fky],
                        dir : crn_tdir
                    }
                }
                if ( p ) {
                    let update_concerns = all_skeletons[file].concerns
                    for ( let [cky, useage]  of Object.entries(concerns) ) {
                        if ( cky in update_concerns ) {
                            update_concerns[cky].usages = update_concerns[cky].usages.concat(useage.usages)
                        } else {
                            update_concerns[cky] = useage
                        }
                    }
                    all_skeletons[file].concerns = update_concerns
                    all_skeletons[file].count = (p.count + 1)
                } else {
                    let count = 1
                    all_skeletons[file] = { count, concerns }
                }
            }
        }
        this.skel_to_concerns = Object.assign({},all_skeletons)
        //
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
     * @param {string} file 
     * @returns {object}
     */
    async load_name_drops_db(file) {
        this.name_drops_db = {}
        let name_db_loc = this.paths.get_path("[names]")
        let name_db_file = file ? file : `${name_db_loc}/name-drop.db`
        if ( file ) {
            return await fos.load_json_data_at_path(name_db_file)
        }
        this.name_drops_db = await fos.load_json_data_at_path(name_db_file)
        return this.name_drops_db
    }



    /**
     * The range parameter is a structure that will have lb (lower bound)
     * and ub (upper bound) filled out if the control string `ctrl_str`
     * matches the pattern. The pattern will be of the fomr `prefix`<lb,ub>`postfix`
     * 
     * @param {string} ctrl_str 
     * @param {object} range 
     * @returns {boolean}
     */
    has_range_expr(ctrl_str,range) {
        let result = this.range_pattern.exec(ctrl_str)
        if ( result ) {
            range.lb = parseInt(result[1])
            range.ub = parseInt(result[2])
            return true
        }
        return false
    }


    /**
     * The `var_holder` parameter is an array that will
     * contain the bracket identifier
     * if the control string `ctrl_str`
     * matches the pattern. The pattern will be of the form `prefix`<identifier>`postfix`
     * 
     * @param {string} ctrl_str 
     * @param {Array} var_holder 
     * @returns {boolean}
     */
    has_list_expr(ctrl_str,var_holder) {
        let result = this.list_pattern.exec(ctrl_str)
        if ( result ) {
            var_holder[0] = result[1]
            return true
        }
        return false
    }



    /**
     * 
     * @param {string} param_str 
     */
    async build_tree(part_key,param_str) {
        //
        if ( param_str[0] === '{' ) {
            param_str = param_str.substring(1,param_str.lastIndexOf('}'))
        }

        let var_tree = {}
        let easy_access_parse = {}

        let sep_point = param_str.indexOf("<<")
        if ( sep_point > 0 ) {
            //
            let key_part = param_str.substring(0,sep_point)
            let rest = param_str.substring(sep_point+2)
            //
            do {
                let check = this.var_spec_pattern.exec(key_part)
                if ( check ) {
                    let sub_tree = {}
                    if ( rest.length ) {
                        rest = await this.capture_param_sub_call(part_key,rest,sub_tree)
                    }
                    if ( Object.keys(sub_tree).length === 0 ) {
                        sub_tree = false
                    }
                    let extracted_var = check[1]
                    let the_file = check[2]
                    //
                    easy_access_parse[extracted_var] = "file"
                    //
                    let data = ""
                    let parts_of_key = part_key.split('::')
                    if ( parts_of_key.length > 1 ) {
                        let [path_finder,ftype] = this.entry_directive_location_remap(parts_of_key[0])
                        let locus = this.top_dir_locations[path_finder]
                        if ( locus ) {
                            if ( the_file.indexOf('::') > 0 ) {
                                the_file = the_file.substring(the_file.indexOf('::') + 2)
                            }
                            let file_path = `${locus}/${the_file}`
                            data = await fos.load_data_at_path(file_path)
                        }
                    }
                    var_tree[extracted_var] = {
                        "file"  : the_file,
                        "tree"  : sub_tree,
                        "data"  : data
                    }
                    if ( this.check_recursive_data(data) ) {
                        let map_value = var_tree[extracted_var]
                        map_value.recursive = await this.get_files_and_vars(part_key,data)
                    }
                }
                //
                if ( rest.length ) {
                    sep_point = rest.indexOf("<<")
                    if ( sep_point ) {
                        key_part = rest.substring(0,sep_point)
                        rest = rest.substring(sep_point+2)
                    } else break
                } else break;

            } while ( key_part.length )
            //
        }

        if ( Object.keys(var_tree).length === 0 ) {
            return false
        }

        let par_state = `_params<${Object.keys(easy_access_parse).join(',')}>`
        var_tree[par_state] = easy_access_parse
        return var_tree
    }


    /**
     * 
     * @param {string} rest 
     * @returns {Number} -- the location of the next
     */
    find_next(rest) {
        if ( rest[0] === '{' ) { // handle recursive object searchs
            let depth = 0
            let index = 1
            while ( depth > -1 ) {
                let c = rest[index]
                if ( c === '{' ) {
                    depth++
                } else if ( c === '}' ) {
                    depth--
                }
                index++
            }
            return index
        } else {
            return 0
        }
    }

    /**
     * 
     * @param {string} rest 
     * @param {object} sub_tree -- gets populated with object information
     */
    async capture_param_sub_call(part_key,rest,sub_tree) {
        let next = this.find_next(rest)
        if ( next ) {
            let param_block = rest.substring(0,next)
            rest = rest.substring(next)
            let a_tree = await this.build_tree(part_key,param_block)
            for ( let ky in a_tree ) {
                sub_tree[ky] = a_tree[ky]
            }
        }
        return rest
    }



    /**
     * 
     * @param {Array} data_parts 
     * @param {object} maybe_params 
     */
    sequence_expansion(data_parts,maybe_params) {
        data_parts = data_parts.map((a_part) => {
            if ( a_part.indexOf("files::") === 0 ) {
                if ( a_part.indexOf("files::loop::") === 0 ) {
                    let range = {
                        lb: 0,
                        ub: 0
                    }
                    let var_holder = []
                    a_part = parse_util.remove_spaces(a_part)
                    a_part = parse_util.remove_white(a_part)
                    if ( this.has_range_expr(a_part.substring("files::loop::".length),range) ) {
                        let replacer = `<${range.lb},${range.ub}>`
                        let lines = []
                        for ( let i = range.lb; i <= range.ub; i++ ) {
                            let this_part = a_part.replace(replacer,`${i}`)
                            this_part = this_part.replace("::loop","")
                            lines.push(this_part)
                        }
                        return lines
                    } else if ( this.has_list_expr(a_part.substring("files::loop::".length,a_part.indexOf('[')),var_holder) ) {
                        let parts = a_part.split('<<')
                        let part_key = parts.shift()
                        part_key = part_key.replace("::loop","")
                        part_key = part_key.substring(0,part_key.indexOf('<'))
                        let part_def = parts.shift()
                        let def = part_def
                        try {
                            def = JSON.parse(part_def)
                        } catch (e){}
                        //
                        let pars = {}
                        pars[var_holder[0]] = "list"
                        pars[`_type<${var_holder[0]}>`] = def
                        maybe_params[part_key] = pars
                        return part_key
                    }
                }
            }
            return a_part
        })
        data_parts = parse_util.flatten(data_parts)
        return data_parts
    }



    /**
     * 
     * @param {Array} data_parts 
     * @param {object} maybe_params 
     */
    async capture_parameters(data_parts,maybe_params) {

        let promisory = data_parts.map(async (a_part) => {
            if ( a_part.indexOf("files::") === 0 ) {
                if ( a_part.indexOf("files::params::") === 0 ) {
                    a_part = parse_util.remove_white(a_part)
                    let parts = a_part.split('<<{')
                    let part_key = parts.shift()
                    let part_def = parts.join('<<{')
                    //
                    maybe_params[part_key] = await this.build_tree(part_key,part_def.substring(0,part_def.lastIndexOf('}')))
                    //
                    return part_key
                }
            }
            return a_part
        })
        data_parts = await Promise.all(promisory)
        return data_parts
    }


    /**
     * pull_out_files
     * @param {object} data_parts 
     */
    pull_out_files(data_parts) {

        let just_files = data_parts.filter((a_part) => {
            return (a_part.indexOf("files::") === 0)
        })
        return just_files.map((a_part) => {
            return ( a_part.substring("files::".length) )
        })

    }

    /**
     * pull_out_script
     * @param {object} data_parts 
     */
    pull_out_script(data_parts) {
        let just_scripts = data_parts.filter((a_part) => {
            return (a_part.indexOf("script::") === 0)
        })
        return just_scripts.map((a_part) => {
            return ( a_part.substring("script::".length) )
        })
    }


    /**
     * pull_out_html_directives
     * @param {object} data_parts 
     */
    pull_out_html_directives(data_parts) {
        let just_html_d = data_parts.filter((a_part) => {
            return (a_part.indexOf("html:") === 0)
        })
        return just_html_d
    }


    /**
     * 
     * @param {object} all_skeletons 
     */
    async section_parsing(all_skeletons) {
        let section_data = {}
        if ( TESTING ) {
            this.test_html = {}
        }
        for ( let [ky,data] of Object.entries(all_skeletons) ) {
            let data_parts = data.split('$$')
            let defaults = data_parts[1]
            data_parts.shift()
            //
            let files = []
            let scripts = []
            let maybe_params = {}
            // for testing

            if ( defaults ) {
                defaults = defaults.trim()
                if ( defaults.indexOf("defs:") === 0 ) {
                    data_parts.shift()
                    defaults = parse_util.clear_comments(defaults).trim()
                    defaults = JSON.parse(defaults.substring("defs:".length))
                }

                data_parts = data_parts.map((el) => { return parse_util.clear_comments(el.trim()).trim() })

                data_parts = await this.sequence_expansion(data_parts,maybe_params)
                data_parts = await this.capture_parameters(data_parts,maybe_params)

                files = this.pull_out_files(data_parts)
                scripts = this.pull_out_script(data_parts)
                // for testing
                if ( TESTING ) {
                    let htmls = this.pull_out_html_directives(data_parts)
                    for ( let html of htmls ) {
                        let p = this.test_html[html]
                        this.test_html[html] = (p ? (p+1) : 1)
                    }
                }
            }
            //
            section_data[ky] = {
                "defaults" : defaults,
                "skeleton" : data_parts,
                "files" : files,
                "scripts" : scripts,
                "parameterized" : maybe_params
            }
        }

        console.log("OUTPUT TEST HTML")
        console.dir(this.test_html)

        return section_data
    }


    /**
     * 
     * Outputs to each concern the variable forms table, yielding default substitutions.
     * If the developer chooses to change these before final template generation he may.
     * 
     */
    async name_parameters_output() {
        //
        let outputs = this.outputs
        for ( let ogroup of outputs ) {
            let concerns = ogroup.targets.concerns
            let name_parameters = ogroup.name_parameters ? true : false
            if ( name_parameters ) {
                for ( let concern of concerns ) {
                    name_parameters = Object.assign({},ogroup.name_parameters)  // actually its an object
                    let drops_db = this.name_drops_db
                    if ( name_parameters.db ) {
                        let name_db = this.paths.compile_one_path(name_parameters.db)
                        drops_db = await this.load_name_drops_db(name_db)
                        delete name_parameters.db
                    }
                    let output = name_parameters.parameter_values ? this.paths.compile_one_path(name_parameters.parameter_values) : false
                    if ( output ) {
                        output = output.replace('@concern',concern)
                        output = output.replace("@target",this.created_dir)
                        delete name_parameters.parameter_values
                        let value_object = {}
                        for ( let [ky,selections] of Object.entries(name_parameters) ) {
                            value_object[ky] = {}
                            let nm_set = drops_db[ky]
                            if ( nm_set ) {
                                for ( let form_name of selections ) {
                                    value_object[ky][form_name] = nm_set[form_name]
                                }
                            }
                        }
                        await fos.write_out_pretty_json(output,value_object,4)
                    }
                }
            }
        }
        //
    }


    /**
     * 
     * @param {object} transform_1 
     * @returns 
     */
    coalesce_scripts(transform_1) {

        let scripts_occurences = {}

        for ( let dpart of Object.values(transform_1) ) {
            let scripts = dpart.scripts
            if ( scripts.length ) {
                for ( let script of scripts ) {
                    let p = scripts_occurences[script]
                    scripts_occurences[script] = p ? p + 1 : 1
                }
            }
        }

        return scripts_occurences
    }


    /**
     * 
     * @param {object} script_stats 
     * @param {number} threshold 
     * @returns {object}
     */
    partition(script_stats) {
        let partitions = []

        let keys = Object.keys(script_stats)
        keys.sort((k1,k2) => {
            let v1 = script_stats[k1]
            let v2 = script_stats[k2]
            return v1 - v2
        })

        let sorted_stats = {}
        for ( let ky of keys ) {
            sorted_stats[ky] = script_stats[ky]
        }

        console.log("sorted_stats")
        console.dir(sorted_stats)

        let bdiff = Object.values(sorted_stats)
        let n = bdiff.length
        let diffs = []
        for ( let i = 0; i < n-1; i++ ) {
            let v0 = bdiff[i]
            let v1 = bdiff[i+1]
            diffs.push(v1-v0)
        }

        console.dir(diffs)

        let last_big_diff = 0
        partitions.push([])
        let p_index = 0
        let skeys = Object.keys(sorted_stats)
        for ( let i = 0; i < n-1; i++ ) {
            let d = diffs[i]
            if ( d > last_big_diff ) {
                d = last_big_diff
                partitions.push([])
                p_index++
            }
            partitions[p_index].push(skeys[i])
        }
        partitions[p_index].push(skeys[n-1])



        // for ( let [file,value] of Object.entries(script_stats) ) {
        //     if ( value >= threshold ) {
        //         partitions.above.push(file)
        //     } else {
        //         partitions.below.push(file)
        //     }
        // }

        return partitions
    }


    /**
     * 
     * @param {object} transformed 
     * @param {object} script_stats 
     */
    update_script_stats_usage(transformed,script_stats) {
        //
        let outputs = this.outputs

        let top_level_skel_counts = {}

        for ( let output of outputs ) {
            let n_concerns = output.targets.concerns.length
            let skeletons = output.skeletons
            let mid_level_skel_counts = {}
            for ( let skel of Object.values(skeletons) ) {
                let p = mid_level_skel_counts[skel]
                mid_level_skel_counts[skel] = p ? p + 1 : 1
            }
            for ( let [skel,count] of Object.entries(mid_level_skel_counts) ) {
                let p = top_level_skel_counts[skel]
                top_level_skel_counts[skel] = p ? p + count*n_concerns : count*n_concerns
            }
        }


        for ( let [skel,count] of Object.entries(top_level_skel_counts) ) {

            let usages = transformed[skel]
            if ( usages ) {

                for ( let script of usages.scripts ) {
                    let p = script_stats[script]
                    if ( p ) {
                        script_stats[script] = p*count
                    }
                }
            }
        }
    }


    /**
     * 
     * @param {string} step_entry 
     * @param {Array} cross_directory_check - optional
     * @returns {Array} - a tripple [file name, token indicating a compiled path, the type of file]
     */
    get_file_data_descriptor(step_entry,cross_directory_check) {
        //
        let file_name = false
        let path_finder = false
        let entry_type = false
        let entry_directive = false
        //
        let file_entry_starter = !(cross_directory_check) ? this.entry_starter.exec(step_entry) : false
        if ( !file_entry_starter ) {
            file_entry_starter = cross_directory_check ? cross_directory_check : this.cross_type_directory.exec(step_entry)
            if ( file_entry_starter ) {
                entry_directive = file_entry_starter[1]
                entry_type = file_entry_starter[2]
                file_name = file_entry_starter[3]
                if ( file_name.indexOf('.') < 0 ) {
                    file_name = `${file_name}.${entry_type}`
                }
                if ( entry_type === 'js' ) entry_type = "script"
            }
        } else {
            entry_directive = file_entry_starter[1]
            file_name = step_entry.substring((entry_directive).length + 2)
        }
        if ( entry_directive ) {
            let [pf,et] = this.entry_directive_location_remap(entry_directive)
            path_finder = pf
            entry_type = (entry_type && (et !== entry_type)) ? entry_type : et
        }
        //
        return [file_name,path_finder,entry_type]
    }


    /**
     * Looks at the entry specifiers and determines the absolute location of a file to load.
     * If successful, this returns an a key-value object with three keys, type, file, data, corresponding to
     * the type of the file, the file path, and the data stored in the file (a string)
     * 
     * @param {string} step_entry 
     * @param {Array} cross_directory_check - optional  .. the result of a RegExp,exec if it is provide
     * @returns {object|string}
     */
    async entry_loading(step_entry,cross_directory_check) {
        //
        let map_value = {}
        let [file_name,path_finder,entry_type] = this.get_file_data_descriptor(step_entry,cross_directory_check)
        //
        if ( file_name ) {
            let file_path = this.top_dir_locations[path_finder]
            if ( file_name[0] === '[' ) {
                let entry_match = this.sibling_type_directory_match.exec(file_name)
                if ( entry_match ) {
                    let path_f = entry_match[1]
                    file_path = this.top_dir_locations[path_f]
                    file_name = entry_match[2]
                } else {
                    // handle special cases where the developer has custom leaf code
                    // use the syntax to get information for constructing the directory name.
                    // Do not load a file. That will be done in a second phase.
                    if ( file_name.indexOf('<') > 0 ) {
                        entry_match = this.concerns_directory_redirect_match.exec(file_name)
                        if ( entry_match ) {
                            let search_form = entry_match[1]
                            let use_case = entry_match[2]
                            let p_finder = entry_match[3]
                            let file_form = this.find_concerns[search_form]
                            let data = `{{{ @{${file_form}} }}}`
                            map_value = {
                                "search_form" : search_form,
                                "file" : this.find_concerns[search_form],
                                "use_case" : use_case,
                                "kernel" : p_finder,
                                "type" : entry_type,
                                "data" : data
                            }
                            return map_value
                        }
                    } else {
                        return "not_handled"
                    }
                }
            }
            file_path = `${file_path}/${file_name}`
            let data = await fos.load_data_at_path(file_path)
            data = parse_util.clear_comments(data)
            map_value = {
                "type" : entry_type,
                "file" : file_path,
                "data" : data
            }
            if ( this.check_recursive_data(data) ) {
                map_value.recursive = await this.get_files_and_vars(step_entry,data)
            }
            //
            this.shared_entries[step_entry] = Object.assign({},map_value)
            return map_value
        }
        return "not hanlded"
    }

    /**
     * The data provided is expected to be a string which may or may not include subfiles or the kind of 
     * variable used in skeleton processing.
     * 
     * This looks to see if there is at least one instance of some structured text indicating that
     * further procesing may be done (especially in a recursive fashion).
     * 
     * @param {string} data 
     * @returns {number}
     */
    check_recursive_data(data) {
        if ( !data ) return false
        //
        if ( data.indexOf("$$file") >= 0 ) {
            return 1
        }
        if ( data.indexOf("$$icons") >= 0 ) {
            return 2
        }
        if ( data.indexOf("$$css") >= 0 ) {
            return 3
        }
        if ( data.indexOf("@{") >= 0 ) {
            return 4
        }
        if ( this.executable_pattern.test(data) ) {
            return 5
        }
        return false
    }


    /**
     * 
     * @param {string} data 
     * @param {object} carrier - an object with the filed `var`
     * @returns 
     */
    list_start(data,carrier) {
        let dat_match = this.start_of_list.exec(data)
        if ( dat_match ) {
            carrier.var = dat_match[1]
            return true
        }
        return false
    }

    /**
     * 
     * @param {object | boolean} params_def 
     * @param {string} data 
     * @returns {object}
     */
    errant_variable_extraction(params_def,data) {
        //
        let eve_results = {}
        let occurrences = data.match(this.var_pattern)
        //
        if ( !occurrences ) return undefined
        //
        occurrences = occurrences.map((occ) => {
            return occ.replace("@{","").replace("}","")
        })
        //
        if ( occurrences.length ) {
            for ( let occur of occurrences ) {
                eve_results[occur] = ""
            }
            if ( !params_def ) {
                params_def = eve_results
            } else {
                for ( let ky of Object.keys(eve_results) ) {
                    if ( !(ky in params_def) ) {
                        params_def[ky] = eve_results[ky]
                    }
                }
            }
            return params_def
        }
        //
        return undefined
    }

    /**
     * 
     * @param {string} step_entry 
     * @param {string} data 
     * @returns {object}
     */
    async get_files_and_vars(step_entry,data) {
        //
        if ( data.indexOf('//') >= 0 ) {
            data = parse_util.clear_comments(data)
        }

        let params_def = false
        let carrier = {}

        let lines = []
        if ( data.startsWith("@params<") ) {
            //
            lines = data.split("\n")
            let first_line = lines.shift()
            first_line = parse_util.remove_spaces(first_line)
            let end_def = first_line.indexOf("}>")
            while ( (end_def < 0) && lines.length ) {
                let next_line = lines.shift()
                next_line = parse_util.remove_spaces(next_line)
                first_line += '\n' + next_line
                end_def = next_line.indexOf("}>")
            }
            //
            let flines = first_line.split('\n')
            first_line = flines.join("")

            // @params<{lr_div:file,logout:file}>
            let var_defs = first_line.replace("@params<","")
            var_defs = var_defs.replace(">","")
            var_defs = var_defs.replace("{",'{\"')
            var_defs = var_defs.replace("}",'\"}')
            //
            let colon_split = var_defs.split(":")
            var_defs = colon_split.join('\":\"')
            let comma_split = var_defs.split(",")
            var_defs = comma_split.join('\",\"')
            //
            try {
                params_def = JSON.parse(var_defs)
            } catch(e) {}
            //
        } else if ( this.list_start(data,carrier) ) {
            //
            lines = data.split("\n")
            let first_line = lines.shift()
            first_line = parse_util.remove_spaces(first_line)
            let end_def = first_line.indexOf("}>")
            while ( (end_def < 0) && lines.length ) {
                let next_line = lines.shift()
                next_line = parse_util.remove_spaces(next_line)
                first_line += '\n' + next_line
                end_def = next_line.indexOf("}>")
            }
            let var_defs = first_line.substring(first_line.indexOf('<{') + 1,first_line.indexOf('}>') + 1)
            //
            var_defs = var_defs.replace("{",'{\"')
            var_defs = var_defs.replace("}",'\"}')
            //
            let colon_split = var_defs.split("<-")
            var_defs = colon_split.join('\":\"')
            let comma_split = var_defs.split(",")
            var_defs = comma_split.join('\",\"')
            try {
                params_def = JSON.parse(var_defs)
            } catch(e) {}
            //
            params_def._var_name = carrier.var
            //
        } else {
            let executables = this.extract_excecutables(data)
            params_def = this.errant_variable_extraction(params_def,data)
            return {params_def, executables}
        }

        params_def = this.errant_variable_extraction(params_def,data)
        //
        let executables = []
        if ( lines.length ) {
            let rest = lines.join('\n')
            executables = this.extract_excecutables(rest)
        }
        //
        return { params_def, executables }
    }



    /**
     * 
     * @param {string} parseable 
     * @param {object} exec_report 
     * @returns {boolean}
     */
    ternary_conditional(parseable,exec_report) {

//console.log("ternary_conditional",parseable)

        let ternary = this.ternary_check.exec(parseable)
        if ( ternary ) {
            let cond = ternary[1].trim()
            //
            let first = ""
            let second = ""
            let third = ""
            //
            if ( parseable.indexOf("::") < 0 ) {
                first = ternary[2]
                second = ternary[3]
                third = false
            } else {
                let prest = parseable.substring(parseable.indexOf('?') + 1)
                prest = prest.split('::')
                //
                first = prest.shift()
                second = prest.shift()
                third = prest.shift()
                //
                if ( first.indexOf(':') > 0 ) {
                    let fparts = first.split(':')
                    first = fparts[0]
                    second = fparts[1] + "::" + second
                    if ( third ) {
                        second = second + "::"  + third
                    }
                } else if ( second && (second.indexOf(':') >= 0) ) {
                    let sparts = second.split(':')
                    first = first + "::" + sparts[0]
                    second = sparts[1]
                    if ( third ) {
                        second = second + "::"  + third
                    }
                }
            }
            //
            let pos = first.trim()
            let neg = second.trim()

            if ( pos === "@nothing" ) pos = ""
            if ( neg === "@nothing" ) neg = ""

            let variable = parse_util.extract_var(cond)

            exec_report.condition = {cond,variable}
            exec_report.positive_exec = {pos}
            exec_report.negative_exec = {neg}
            //
            return true
        }
        return false
    }




    /**
     * 
     * @param {string} parseable 
     * @returns 
     */
    parse_executable(parseable) {
        //
//console.log("parse_executable",parseable)
        let exec = {
            "replace" : parseable,
            "condition" : true,
            "positive_exec" : parseable.trim(),
            "negative_exec" : "",
        }
        parseable = parseable.replace(">>","").trim()
        parseable = parseable.substring(0,parseable.lastIndexOf("<<")).trim()
        if ( this.ternary_conditional(parseable,exec) ) {
            //
            let an_import = this.seek_imports(exec.positive_exec.pos)
            if ( an_import ) {
                exec.positive_exec.replace = exec.positive_exec.neg
                exec.positive_exec.file = an_import
            }
            an_import = this.seek_imports(exec.negative_exec.neg)
            if ( an_import ) {
                exec.negative_exec.replace = exec.negative_exec.neg
                exec.negative_exec.file = an_import
            }
            //
        }
        return exec
    }


    /**
     * seek_imports
     * 
     * @param {string} maybe_imports 
     * @returns {Array | boolean}
     */
    seek_imports(maybe_imports) {
        let type = this.check_recursive_data(maybe_imports)
        let rest = maybe_imports
        //
        let imports = []
        let i = 0
        while ( (type >= 1) && (type <= 3) && rest.length ) {
            let entry_loc = rest.indexOf('$$')
            if ( entry_loc < 0 ) break;
            //
            let replacer = rest.indexOf("<<") >= 0 ? rest.substring(entry_loc,rest.indexOf("<<") + 2) : undefined
            let step_entry = rest.substring(entry_loc + 2)
            rest = rest.substring(entry_loc + 2 + step_entry.indexOf("::"))
            
            if ( step_entry.length ) {
                if ( step_entry.indexOf("<<") > 0  ) {
                    step_entry = step_entry.substring(0,step_entry.indexOf("<<"))
                    rest = rest.substring(rest.indexOf("<<")+2)
                }
                //
                let [file_name, path_finder, entry_type] = this.get_file_data_descriptor(step_entry)
                //
                let map_value = {
                                "replace" : replacer,
                                "type" : entry_type,
                                "file" : file_name,
                                "path_finder" : path_finder,
                                "data" : false
                            }
                //
                imports.push(map_value)
                this.delay_file_loading_queue.push(map_value)
            }
            if ( rest.indexOf('<<') > 0 ) {
                type = this.check_recursive_data(rest)
            } else break
        }
        if ( imports.length ) return imports
        return false
    }

    /**
     * extract_excecutables
     * 
     * @param {string} data_form 
     * @returns {object}
     */
    extract_excecutables(data_form) {
        //
        let execs = []
        let imports = []
        if ( data_form.indexOf('>>') >= 0 ) {
            let parts = data_form.split('>>')
            for ( let i = 1; i < parts.length; i++ ) {
                let p = parts[i]
                let skip = 2
                let reattach_end = "<<"
                if ( p.indexOf("<<<<") > 0 ) {  // executable with import
                    p = p.substring(0,p.indexOf("<<<<"))
                    reattach_end = "<<<<"
                    skip = 4
                } else {
                    p = p.substring(0,p.indexOf("<<"))
                }
                parts[i] = p.substring(p.indexOf("<<") + skip)
                p = this.parse_executable(">>" + p + reattach_end)
                execs.push(p)
            }
            for ( let i = 1; i < parts.length; i++ ) {
                let an_import = this.seek_imports(parts[i])
                if ( an_import ) {
                    imports = imports.concat(an_import)
                }
            }
        } else {
            imports = this.seek_imports(data_form)
        }
        return {execs,imports}
    }

    //
    // case 1:
    // @params<{lr_div:file,logout:file}>
    //
    // case 2:
    // @list<el><{ group_name <- el[1], SOURCE-LINK <- el[2], FRAME-ACTIONS <- el[3]}>
    // ...
    // <@el>
    //  ...
    // </@el>
    //
    // case 3:
    // >>@{FRAME-ACTIONS} ? @{FRAME-ACTIONS} : @nothing <<
    // 
    // case 4:
    // @{group_name}
    //
    // case 5: 
    // >> any action at all <<
    // EXAMPLE: >> @p = 2 + 4; put @p here; put @p after next div; <<
    // EXAMPLE: >> @p = 2 + 4; @bubble = @p; << //late @bubble appears in the html (text)
    // 
    // case 6:
    // $$icons::mushroom-menu-icon.svg
    // OR $$`path-finder`::`file-stem`.`ext`
    //


    is_language_section_control(step_entry) {
        return false
    }

    /**
     *  // generalization for later
     * @param {string} step_entry 
     * @returns {string}
     */
    extract_lang_controller_key(step_entry) {
        return step_entry.substring(0,step_entry.indexOf(':'))
    }



    /**
     * has_calc(entry_data)
     */

    has_calc(entry_data) {

        for ( let fcall of Object.values(entry_data.key_values) ) {
            if ( (fcall === "f@incr{$}") || (fcall === "f@init{$}") ) {
                continue
            }
            let parse_call = this.basic_function_call_match.exec(fcall)
            if ( parse_call ) {
                return true
            }
        }

        return false
    }


    /**
     * 
     * @param {object} entry_data 
     * @returns {Array}
     */
    gather_calculations(entry_data) {
        let all_calls = []
        for ( let [vname,fcall] of Object.entries(entry_data.key_values) ) {
            if ( (fcall === "f@incr{$}") || (fcall === "f@init{$}") ) {
                continue
            }
            let parse_call = this.basic_function_call_match.exec(fcall)
            if ( parse_call ) {
                let one_call = {}
                one_call.set_var = vname
                one_call.func = parse_call[1]
                one_call.param = parse_call[2]
                //
                all_calls.push(one_call)
            } else {
                let one_call = {}
                one_call.set_var = vname
                one_call.func = "copy"
                one_call.param = fcall // actually just a string
                //
                all_calls.push(one_call)
            }
        }
        return all_calls
    }


    /**
     * 
     * @param {object} entry_data 
     * @param {string} fcall 
     * @param {string} caller_stem 
     */
    make_call(entry_data,fcall,caller_stem) {
        let func = fcall.func
        if ( (typeof entry_data.evaluations) !== "object" ) {
            entry_data.evaluations = {}
        }
        switch ( func ) {
            case "name" : {
                let target = fcall.param
                if ( target === "parent" ) {
                    entry_data.evaluations[fcall.set_var] = caller_stem
                }
                break;
            }
            case "copy" : {
                 entry_data.evaluations[fcall.set_var] = fcall.param
                break
            }
            default: {
                break
            }
        }
    }


    /**
     * 
     * @param {port_modules} entry_data 
     * @returns {boolean}
     */
    conditionless_evaluations_substitution(entry_data) {
        let data = entry_data.data

        if ( !data ) return false
        if ( data.indexOf("?") > 0 ) {
            if ( this.ternary_check.test(data) ) {
                return false
            }
        }
        
        let evals = entry_data.evaluations

        if ( (typeof evals === "object") && Object.keys(evals).length ) {
            for ( let [vky, vval]  of Object.entries(evals) ) {
                let var_form = `@{${vky}}`
                data = parse_util.subst(data,var_form,vval)
            }
            entry_data.data = data
        }
        return true
    }


    /**
     * 
     * @param {object} entry_data 
     * @returns {boolean}
     */
    has_incrementer(entry_data) {
        //
        if ( typeof entry_data.key_values === "object" ) {
            let values = Object.values(entry_data.key_values)
            for ( let val of values ) {
                if ( (val === "f@incr{$}") || (val === "f@init{$}") ) {
                    return true
                }
            }
        }
        //
        return false
    }


    /**
     * 
     * @param {object} incrementer_set 
     * @param {string} step_entry 
     * @param {object} entry_data 
     */
    add_to_incrementers(incrementer_set,entry_data,var_set_expr) {
        //
        let incr_vname = false
        let start_val = false
        let op = ""
        if ( var_set_expr.length ) {
            let unloader = this.var_set_expr_pattern.exec(var_set_expr)
            if ( unloader ) {
                let vexpr = unloader[1]
                if ( vexpr.indexOf("=") > 0 ) {
                    let pieces = vexpr.split('=')
                    incr_vname = pieces[0]
                    start_val = parseInt(pieces[1].trim())
                    op = '='
                } else if ( vexpr.indexOf("++") > 0 ) {
                    incr_vname = vexpr.substring(0,vexpr.indexOf("++"))
                    op = "++"
                } else if ( vexpr.indexOf("--") > 0 ) {
                    incr_vname = vexpr.substring(0,vexpr.indexOf("--"))
                    op = "--"
                }
            }
        }
        if ( (typeof entry_data === "object") &&  (typeof entry_data.key_values === "object") ) {
            for ( let [vname, form] of Object.entries(entry_data.key_values) ) {
                if ( (form === "f@incr{$}") || (form === "f@init{$}") ) {
                    let ky_vname = incr_vname ? incr_vname : vname
                    entry_data.op = op
                    if ( ky_vname in incrementer_set ) {
                        let incr_descr = incrementer_set[ky_vname]
                        if ( form === "f@init{$}" ) {
                            incr_descr.starter = entry_data
                            incr_descr.start_val = start_val
                        } else {
                            incr_descr.list.push(entry_data)
                        }
                    } else {
                        incrementer_set[ky_vname] = {
                            "print_vname" : ky_vname,
                            "apply_to" : vname,
                            "start_val" : start_val,
                            "starter" : entry_data,
                            "list" : [entry_data]
                        }
                    }
                    return true
                }
            }
        }
        return false
        //
    }


    /**
     * 
     * @param {stringify} skeleton_src 
     */
    async leaf_hmtl_directives(skeleton_src) {

        this.shared_entries = {}

        for ( let [sk_key, skel_def ] of Object.entries(skeleton_src) ) {
            let sk_map = {}
            let incrementer_set = {}
            let lang_spec_count = 0
            let skeleton = skel_def.skeleton
            for ( let step_entry of skeleton ) {
                step_entry = step_entry.replace('<<','')
                // now get its value depending on its tyle
                if ( step_entry.startsWith('html:') ) {
                    lang_spec_count++
                    let html_map = base_patterns_mod['html:']
                    let ky = step_entry.substring('html:'.length)
                    step_entry = step_entry.replace('html:',`html(${lang_spec_count}):`)
                    sk_map[step_entry] = html_map[ky]
                } else if ( this.is_language_section_control(step_entry) ) {  // a generalization for later
                    lang_spec_count++
                    let lang_key = this.extract_lang_controller_key(step_entry)
                    let lang_map = base_patterns_mod[lang_key]
                    let ky = step_entry.substring(lang_key.length)
                    step_entry = step_entry.replace(lang_key,`${lang_key}(${lang_spec_count}):`)
                    sk_map[step_entry] = lang_map[ky]
                } else if ( step_entry.startsWith('verbatim::') ) {
                    let str = step_entry.substring(('verbatim::').length)
                    let hashed = crypto.hash('sha1',str)        // cryptos
                    sk_map[`verbatim::${hashed}`] = str
                } else {
                    let entry = this.shared_entries[step_entry]
                    if ( entry && typeof entry === "object" ) {
                        sk_map[step_entry] = Object.assign({},entry)
                    } else {
                        if ( step_entry.startsWith('files::') || step_entry.startsWith('files<') ||step_entry.startsWith('css::') ) {
                            if ( step_entry.startsWith('files::calc::') ) {
                                sk_map[step_entry] = "name"
                                if ( step_entry.indexOf("_<") < 0 ) {
                                    let var_set_expr = ""
                                    let db = this.name_drops_db
                                    let db_ky = step_entry.substring("files::calc::".length)
                                    if ( db_ky.indexOf("$") > 0 ) {
                                        let db_ky_parts = db_ky.split("$")
                                        db_ky = db_ky_parts[0]
                                        var_set_expr = db_ky_parts[1]
                                    }
                                    let entry_data = db[db_ky]
                                    let back_ref_ky = db_ky
                                    if ( typeof entry_data === "object" ) {
                                        sk_map[step_entry] = Object.assign({},entry_data)
                                    } else {
                                        back_ref_ky = db_ky
                                        db_ky = db_ky.substring(0,db_ky.lastIndexOf('_') + 1)
                                        entry_data = db[db_ky]
                                        sk_map[step_entry] = Object.assign({},entry_data)
                                    }
                                    entry_data = sk_map[step_entry]
                                    if ( entry_data.file ) {        // delay loading the file ... 
                                        entry_data.path_finder = "html"
                                        this.delay_file_loading_queue.push(entry_data)
                                    }
                                    if ( this.has_incrementer(entry_data) ) {
                                        this.add_to_incrementers(incrementer_set,entry_data,var_set_expr)
                                    }
                                    //
                                    if ( this.has_calc(entry_data) ) {
                                        let calls = this.gather_calculations(entry_data)
                                        for ( let a_call of calls ) {
                                            this.make_call(entry_data,a_call,back_ref_ky)
                                        }
                                    }
                                    //
                                }
                               //
                                //
                            } else if ( step_entry.startsWith('files::params::') || step_entry.startsWith('css::params::') ) {
                                let loadable_entry = step_entry.replace("::params","")
                                sk_map[step_entry] = await this.entry_loading(loadable_entry)
//console.log("NEED PARAMS HANDLING")
                            } else if ( step_entry.startsWith('files::elements::') || step_entry.startsWith('css::elements::') ) {
                                let loadable_entry = step_entry.replace("::elements","")
                                sk_map[step_entry] = await this.entry_loading(loadable_entry)
//console.log("NEED ELEMENTS HANDLING")
                            } else {
                                sk_map[step_entry] = await this.entry_loading(step_entry)
                            }
                        } else if ( step_entry.startsWith('template::') ) {
                            let data = step_entry.substring(('template::').length)
                            data = data.trim()
                            let brace_i = data.indexOf('{')
                            let brace_n = data.lastIndexOf('}')
                            data = data.substring(brace_i,brace_n-1)
                            data = parse_util.clear_comments(data)
                            //
                            sk_map[step_entry] = {
                                "type" : "template",
                                "data" : data
                            }
                            if ( this.check_recursive_data(data) ) {
                                sk_map[step_entry].recursive = await this.get_files_and_vars(step_entry,data)
                            }
                        } else if ( step_entry.startsWith('script::') ) {
                            let script_spec =  await this.entry_loading(step_entry)
                            let data_form = script_spec.data
                            if ( typeof script_spec.kernel !== "undefined" ) {
                                let sk_c = Object.assign({},this.skel_to_concerns[sk_key].concerns)
                                for ( let [crn,usages] of Object.entries(sk_c) ) {
                                    let dr = usages.dir
                                    dr = dr.replace('@kernel',script_spec.kernel)
                                    dr = this.paths.compile_one_path(dr)
                                    usages.dir = dr
                                    let dir_key = '@{[targets.dir]}'
                                    let dat = data_form.replace(dir_key,dr)
                                    if ( dat === data_form ) {
                                        dir_key = `@{[targets.dir]/${script_spec.use_case}}`
                                        dat = data_form.replace(dir_key,dr)
                                    }
                                    usages.data = dat
                                }

                                script_spec.customizations = sk_c
                                //
                            }
                            sk_map[step_entry] = script_spec
                        } else {
console.log("NOT HANDLED YET: ",step_entry)
                            sk_map[step_entry] = ""
                        }
                    }
                }
            }
            skel_def.skeleton_map = sk_map
            skel_def.incrementer_set = incrementer_set
        }
    }



    /**
     * Called after other processing during the preparation phase, but before writing out the results of preparation.
     * 
     * There is queue, `delay_file_loading_queue`, that hold structures with empty data components and with file names. 
     * The elements of the queue were processed during synchronous analysis of text and time was not alloted to 
     * loading the data. 
     * 
     * This loads the data asynchronously from the files on the queue, parallelizing the loading as much as possible 
     * with a Promise.all.
     * 
     */
    async delay_file_loading() {
        let q = this.delay_file_loading_queue
        let name_to_data = {}
        //
        if ( q.length ) {
            for ( let el of q ) {
                if ( el.file ) {
                    name_to_data[el.file] = el.path_finder
                }
            }
            //
            let loader_promises = []
            for ( let [file,path_finder] of Object.entries(name_to_data) ) {
                let file_path = this.top_dir_locations[path_finder]
                let file_name = `${file_path}/${file}`
                let p = fos.load_data_at_path(file_name)
                loader_promises.push(p)
            }
            let loader_data = await Promise.all(loader_promises)
            let keys = Object.keys(name_to_data)
            for ( let dat of loader_data ) {
                let key = keys.shift()
                name_to_data[key] = dat
            }
            //
        }

        return name_to_data
    }


    evaluate_delayed_queue(name_to_data) {
        let q = this.delay_file_loading_queue
        if ( q && q.length ) {
            for ( let el of q ) {
                el.data = "" + name_to_data[el.file]            // data first enters into the entry object here
                if ( el.evaluations || el.recursive ) {         // only backup files that have skeletal level evaluations
                    el.backup_data = "" + el.data               // if the user runs an intermediate step, then the original data will be utilized     
                }
                if ( el.evaluations ) {
                    this.conditionless_evaluations_substitution(el)
                }
            }
        }
    }


    /**
     * 
     * @param {Array} conds 
     * @param {object} params 
     * @returns {Array}
     */
    conds_reduction(conds,params) {
        //
        let reduced_conds = []
        for ( let cond of conds ) {
            //
            let vname = cond.condition.variable
            let val = params[vname]
            let vform = cond.condition.cond
            let replacer = ""
            if ( val && (typeof val === "string") && val.length > 0 ) {
                replacer = cond.positive_exec.pos
                replacer = parse_util.subst(replacer,vform,val)
            } else {
                replacer = cond.negative_exec.neg
                replacer = parse_util.subst(replacer,vform,val)
            }
            //
            let a_reduction = {
                "replace" :  cond.replace,
                "replacer" : replacer
            }
            reduced_conds.push(a_reduction)
        }

        return reduced_conds
    }


    /**
     * 
     * @param {string} data 
     * @param {Array} subst_list 
     * @param {string} index_var 
     */
//<@el>
// </@el>

    map_to_substs(data,subst_list,index_var) {
        //
        let loop_start_len = index_var.length + "<@>".length
        let loop_body_start = data.indexOf(`<@${index_var}>`) + loop_start_len
        let loop_body_end = data.indexOf(`</@${index_var}>`)

        for ( let asubst of subst_list ) {
            //
            let loop_body = data.substring(loop_body_start,loop_body_end)
            //
            let params = asubst.params_def
            let conds = asubst.conds
            //
            for ( let acond of conds ) {
                loop_body = parse_util.subst(loop_body,acond.replace,acond.replacer)
            }
            for ( let param in params ) {
                let var_form = `@{${param}}`
                let val = params[param]
                loop_body = parse_util.subst(loop_body,var_form,val)
            }
            //
            asubst.data = loop_body
        }
        
    }



    /**
     * 
     * @param {object} transformed 
     */
    conditional_evaluations(transformed) {
        for ( let [sk_name,skel] of Object.entries(transformed) ) {
            let sk_map = skel.skeleton_map
            if ( typeof sk_map !== "object" ) continue
            if ( skel.parameterized ) {
                for ( let [entry_ky,desciptor] of Object.entries(skel.parameterized) ) {
                    let keys = Object.keys(desciptor)
                    let list_key = keys.find((ky) => {  // find all list types
                        if ( ky.startsWith("_type<") ) {
                            return true
                        } else {
                            return false
                        }
                    })
                    let parameter_key = keys.find((ky) => {  // find all list types
                        if ( ky.startsWith("_params<") ) {
                            return true
                        } else {
                            return false
                        }
                    })
                    //
                    if ( list_key ) {
                        let entry = sk_map[entry_ky]
                        if ( entry.subst_recursive && entry.conds ) {
                            for ( let evalr of entry.subst_recursive ) {
                                let params = evalr.params_def
                                evalr.conds = this.conds_reduction(entry.conds,params)
                            }
                            let data = entry.data
                            entry.backup_data = "" + data
                            this.map_to_substs(data,entry.subst_recursive,entry.recursive.params_def._var_name)
                        } else {
                            continue
                        }
                    }
                    if ( parameter_key ) {
                        let pars = parameter_key.replace("_params<","").replace(">","").split(",")
                        for ( let par of pars ) {
                            if ( typeof desciptor[par].tree === "object" ) {
                                this.go_deep(desciptor[par])
                            } else {
                                console.log("par with value",par)
                            }
                        }
                    }
                }
            }
        }
    }



    go_deep(param_descr) {
        //
        param_descr.backup_data = "" + param_descr.data
        //console.dir(param_descr.tree)
        //
        let keys = Object.keys(param_descr.tree)
        
        //
        let parameter_key = keys.find((ky) => {  // find all list types
            if ( ky.startsWith("_params<") ) {
                return true
            } else {
                return false
            }
        })
        //
        if ( parameter_key ) {
            let pars = parameter_key.replace("_params<","").replace(">","").split(",")
            for ( let par of pars ) {
                if ( typeof param_descr.tree[par] === "object" ) {
                    let pdescr = param_descr.tree[par]
                    if ( typeof pdescr.tree === "object" ) {
                        this.go_deep(pdescr)
                    } else {
                        if ( pdescr.recursive ) {
console.log("par with recursive",par)
                        } else {
                            console.log("par with value",par)
                        }
                    }
                }
            }
        }
    }


    /**
     * 
     * @param {Array} exec_list 
     */

    find_conditionals(exec_list) {
        //
        if ( exec_list && Array.isArray(exec_list) ) {
            let conds_only = exec_list.filter((el) => {
                if ( el.condition && (typeof el.condition === "object") ) {
                    return true
                }
                return false
            })
            return conds_only
        }
        return false
        //
    }



    list_to_skeletal_variable_assignment(transformed) {
        for ( let [sk_name,skel] of Object.entries(transformed) ) {
            let sk_map = skel.skeleton_map
            if ( typeof sk_map !== "object" ) continue
            if ( skel.parameterized ) {
                for ( let [entry_ky,desciptor] of Object.entries(skel.parameterized) ) {
                    let keys = Object.keys(desciptor)
                    let list_key = keys.find((ky) => {
                        if ( ky.startsWith("_type<") ) {
                            return true
                        } else {
                            return false
                        }
                    })
                    //
                    if ( list_key ) {
                        let entry = sk_map[entry_ky]
                        if ( entry.recursive ) {
console.log("list_to_skeletal_variable_assignment",entry.recursive.params_def)
                        } else {
                            continue
                        }
                        let par_src = entry.recursive.params_def
                        entry.subst_recursive = []
                        let el_var = list_key.replace("_type<","").replace(">","").trim()
                        if ( desciptor[el_var] === "list" ) {
                            let alist = desciptor[list_key]
                            if ( Array.isArray(alist) ) {
                                for ( let var_vals of alist ) {
                                    // entry.subst_recursive
                                    let subst_vals = {}
                                    for ( let ky in par_src ) {
                                        subst_vals[ky] = var_vals[ky]
                                    }
                                    entry.subst_recursive.push({ "params_def" : subst_vals })
                                    entry.conds = this.find_conditionals(entry.recursive.executables.execs)
                                }
                            }
                        }
                    }
                    //
                }
            }
        }
    }



    /**
     * 
     * @param {object} transformed 
     */
    incremental_evaluations(transformed) {
        //
        for ( let [sk_name,skel] of Object.entries(transformed) ) {
            if ( typeof skel.incrementer_set === "object" ) {
                for ( let [ky_vname,incr_descr] of Object.entries(skel.incrementer_set) ) {
                    let subst_var = `@{${incr_descr.apply_to}}`
                    let i = parseInt(incr_descr.start_val)
                    let n = incr_descr.list.length
                    let stepper = incr_descr.starter
                    //
                    let data = stepper.data
                    stepper.data = parse_util.subst(data,subst_var,i)
                    let l = incr_descr.list
                    for ( let k = 0; k < n; k++ ) {
                        let next = l[k]
                        if ( next !== stepper ) {
                            i++
                            let data = next.data
                            next.data = parse_util.subst(data,subst_var,i)
                        }
                    }
                }
            }
        }
        //
    }


    /**
     * section_parsing(all_skeletons)
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
        let transform_1 = await this.section_parsing(all_skeletons)

        let script_stats = this.coalesce_scripts(transform_1)
        this.update_script_stats_usage(transform_1,script_stats)

        let occurence_partition = this.partition(script_stats)

        await this.leaf_hmtl_directives(transform_1)

        let name_to_data = await this.delay_file_loading()

        this.evaluate_delayed_queue(name_to_data)

        this.incremental_evaluations(transform_1)

        this.list_to_skeletal_variable_assignment(transform_1)

        this.conditional_evaluations(transform_1)

        let str = JSON.stringify(transform_1,null,4)
        await fos.write_out_string(this.top_level_parsed,str)
    }




    // ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ----


    /**
     * 
     */
    async generate_all_concerns_templates() {

    }




    /**
     * 
     * @param {*} el_var_map - var name and types
     * @param {*} el        - var name and values
     * @param {*} target_data 
     * @return {string}
     * 
     */
    var_substitution(el_var_map,el,target_data) {
        //
        let td_update = "" + target_data
        for ( let [ky,vtype] of el_var_map ) {
            let  val = el[ky]
            if ( typeof val === vtype ) {
                td_update = parse_util.subst(td_update,`@{${ky}}`,val)
                delete el[ky]  // may test to see if something is not sets
            }
        }
        //
        return td_update
    }


    /**
     * 
     * @param {object} resolver 
     * @returns {string}
     */
    assemble_subfile(resolver) {
        // return ""
        let {file,tree,data,recursive} = resolver
        //
        let tranformed_data = "" + data
        let var_assigns = this.parameterized_block_unification(file,recursive,tree)
        if ( var_assigns && (typeof var_assigns === "object") ) {
            //
            let executables = recursive.executables
            let required_values = recursive.params_def
            if ( executables && required_values ) {
                for ( let execu of executables ) {
                    let replace_form = execu.replace
                    let cond = execu.condition
                    let vname = cond.variable
                    let case_to_use = ""
                    if ( required_values[vname] !== undefined ) {
                        case_to_use = execu.positive_exec.pos
                    } else {
                        case_to_use = execu.negative_exec.neg
                    }
                    tranformed_data = tranformed_data.replace(replace_form,case_to_use)
                }
            }
            //
            tranformed_data = this.var_substitution(resolver,var_assigns,tranformed_data)
        }
        //
        return tranformed_data
    }


    /**
     * This is a test...
     * 
     * @param {object} vset 
     * @param {string} data 
     */
    resolve_with_configuration(vset,data) {
        let vsource = Object.assign({},this.global_variable_values)
        let t_data = this.var_substitution(vset,vsource,data)
        //
        this.vars_unset_in_run = Object.assign({},this.vars_unset_in_run,vsource)
        //
        return t_data
    }


    /**
     * This is supposed to be the starting point got calling variable instantiation
     * on the blocks at the skeleton level. The level_1_parameterized_file parameter 
     * should be the expansion that is the value keyed by the file name in the skeleton map.
     * 
     * 
     * 
     * @param {string} file_key 
     * @param {object} level_1_parameterized_file 
     * @param {object} parameterization_map 
     */
    parameterized_block_unification(file_key,level_1_parameterized_file,parameterization_map) {
        let file_inputs = parameterization_map[file_key]    // skeletal level parameterizations from loaded subfiles (e.g. key is file at the skeleton level)
        let l1pf = level_1_parameterized_file   // already got it when getting file key (a description of what is in the file at the skeleton level)
        try {
            let required_values = l1pf.recursive.params_def  // variable to types (sibling to executable if present)
            let executables = l1pf.recursive.executables
            for ( let [vname,vtype] of Object.entries(required_values) ) {
                if ( vname[0] === '_' ) continue
                let resolver = file_inputs[vname]  // 
                if ( resolver[vtype] ) {
                    let resolved_data = ""
                    switch( vtype ) {
                        case "file" : {
                            if ( resolver.tree ) {
                                resolved_data = this.assemble_subfile(resolver)
                            } else {
                                resolved_data = resolver.data
                            }
                            break;
                        }
                        case "list" : {
                            let vtype_def = `_type<${vname}>`
                            let el_var_map = required_values[vtype_def]
                            //
                            let data_tmplt = l1pf.data
                            let start_loop = `<${vname}>`
                            let end_loop = `</${vname}>`
                            let loop_part = data_tmplt.substring(data_tmplt.indexOf(start_loop),data_tmplt.indexOf(end_loop))
                            let dlist = resolver[vtype]
                            for ( let el of dlist ) {
                                let el_subst = this.var_substitution(el_var_map,el,loop_part)
                                if ( el_subst ) {
                                    resolved_data += el_subst
                                }
                            }
                            //
                            break;
                        }
                    }

                    required_values[vname] = resolved_data
                }
            }

            let data = l1pf.data
            if ( executables ) {
                for ( let execu of executables ) {
                    let replace_form = execu.replace
                    let cond = execu.condition
                    let vname = cond.variable
                    let case_to_use = ""
                    if ( required_values[vname] !== undefined ) {
                        case_to_use = execu.positive_exec.pos
                    } else {
                        case_to_use = execu.negative_exec.neg
                    }
                    data = data.replace(replace_form,case_to_use)
                }
                l1pf.data = data
            }
            l1pf.data = this.var_substitution(required_values,required_values,data)

            data = l1pf.data
            let vset = {}
            vset = this.errant_variable_extraction(vset,data)
            if ( vset && Object.keys(vset).length ) {
                l1pf.data = this.resolve_with_configuration(vset,data)
            }

        } catch (e) {}
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

        await this.load_name_drops_db()
        //
        await this.skeleton_parsing(all_skeletons)
        await this.name_parameters_output()
    }


}



/**
 * 
 * @param {object} args 
 */
async function command_line_operations_new(args) {
    let phase = args.phase
    //
    if ( phase ) {
        //
        console.log("Operating phase:\t\t\t\t\t", phase)
        switch ( g_argv.phase ) {
            case "prepare" :
            case 1: {                       /// creates templates
                let project_dir = args.sources
                let generator = args.generator  // a string
                generator = `${project_dir}/${generator}`
                console.log("Using input configuration for generator:\t\t",generator)
                //
                let parsed = args.structure
                parsed = `${project_dir}/${parsed}`
                console.log("Using output to configuration for template formation:\t\t",parsed)

                let conf = await fos.load_json_data_at_path(generator)
                if ( conf ) {
                    conf.top_level_parsed = parsed
                    let to_templates = new SkelToTemplate(conf)
                    await to_templates.prepare_directories()
                    await to_templates.skeleton_unification()
                    //await to_templates.generate_all_concerns_templates()
                }
                break
            }
            case "template" :
            case 3: {
                let project_dir = args.sources
                let generator = args.generator  // a string
                generator = `${project_dir}/${generator}`
                console.log("Using input configuration from generation:\t\t",generator)

                let parsed = args.structure
                parsed = `${project_dir}/${parsed}`
                console.log("Using input configuration for template formation:\t\t",parsed)

                //await to_templates.generate_all_concerns_templates()
                break
            }
            case "page"   :
            case "assign" :
            case 3: {
                let project_dir = args.sources
                let substitutions = args.values
                substitutions = `${project_dir}/${substitutions}`
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

    console.log("-------------------------------------------------------------")

}


console.log("-------------------------------------------------------------")
console.log("roll-right static content management and module publication")
console.log("-------------------------------------------------------------")

// command_line_operations()


command_line_operations_new(g_argv)