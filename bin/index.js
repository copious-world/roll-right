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

const {base_patterns} = require('../lib/html_directives')
const crypto = require('crypto')

// needs module
let parse_util = {
    clear_comments : (str) => {
        if ( str.indexOf("verbatim::") === 0 ) {
            let check_end = str.lastIndexOf('}')
            if ( check_end > 0 ) {
                let front = str.substring(0,check_end+1)
                return front
            }
        } else {
            if ( str.indexOf("//") > 0 ) {
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
        return str
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
        this.top_level_parsed = conf.top_level_parsed
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

        this.range_pattern = new RegExp(/.*\<(\d),(\d)\>\<\</)
        //
        this.var_spec_pattern = new RegExp(/^\$\@\{(\w+)\}\$files\:\:(.*)$/)

        this.name_drops_db = {}

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
     * 
     * @param {string} ctrl_str 
     * @param {object} range 
     * @returns {boolean}
     */
    has_range_expr(ctrl_str,range) {
        let result = this.range_pattern.exec(ctrl_str)
        if ( result ) {
            range.lb = result[1]
            range.ub = result[2]
            return true
        }
        return false
    }


    /**
     * 
     * @param {object} data_parts 
     */
    sequence_expansion(data_parts) {
        data_parts = data_parts.map((a_part) => {
            if ( a_part.indexOf("files::") === 0 ) {
                if ( a_part.indexOf("files::name::") === 0 ) {
                    let range = {
                        lb: 0,
                        ub: 0
                    }
                    a_part = parse_util.remove_spaces(a_part)
                    if ( this.has_range_expr(a_part.substring("files::name::".length),range) ) {
                        let replacer = `<${range.lb},${range.ub}>`
                        let lines = []
                        for ( let i = range.lb; i <= range.ub; i++ ) {
                            lines.push(a_part.replace(replacer,`${i}`))
                        }
                        return lines
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
     * @param {string} param_str 
     */
    build_tree(param_str) {
        if ( param_str[0] === '{' ) {
            param_str = param_str.substring(1,param_str.lastIndexOf('}'))
        }

        let var_tree = {}

        let sep_point = param_str.indexOf("<<")
        if ( sep_point > 0 ) {
            //
            let key_part = param_str.substring(0,sep_point-1)
            let rest = param_str.substring(sep_point+2)
            //
            do {

                let check = this.var_spec_pattern.exec(key_part)
                if ( check ) {
                    let sub_tree = {}
                    if ( rest.length ) {
                        rest = this.capture_param_sub_call(rest,sub_tree)
                    }
                    if ( Object.keys(sub_tree).length === 0 ) {
                        sub_tree = false
                    }
                    let extracted_var = check[1]
                    var_tree[extracted_var] = {
                        "file"  : check[2],
                        "tree"  : sub_tree
                    }
                }

                if ( rest.length ) {
                    sep_point = rest.indexOf("<<")
                    if ( sep_point ) {
                        key_part = rest.substring(0,sep_point-1)
                        rest = rest.substring(sep_point+2)
                    } else break
                } else break;

            } while ( key_part.length )
            //
        }

        if ( Object.keys(var_tree).length === 0 ) {
            return false
        }

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
    capture_param_sub_call(rest,sub_tree) {
        let next = this.find_next(rest)
        if ( next ) {
            let param_block = rest.substring(0,next)
            rest = rest.substring(next)
            let a_tree = this.build_tree(param_block)
            for ( let ky in a_tree ) {
                sub_tree[ky] = a_tree[ky]
            }
        }
        return rest
    }


    /**
     * 
     * @param {*} data_parts 
     * @param {*} maybe_params 
     */
    capture_parameters(data_parts,maybe_params) {

        data_parts = data_parts.map((a_part) => {
            if ( a_part.indexOf("files::") === 0 ) {
                if ( a_part.indexOf("files::params::") === 0 ) {
                    a_part = parse_util.remove_white(a_part)
                    let parts = a_part.split('<<{')
                    let part_key = parts.shift()
                    let part_def = parts.join('<<{')
                    //
                    maybe_params[part_key] = this.build_tree(part_def.substring(0,part_def.lastIndexOf('}')))
                    //
                    return part_key
                }
            }
            return a_part
        })
        return data_parts
    }


/*

$$files::params::nav_bar_V.tmplt<< {
    $@{lr_div}$files::left-right-div.tmplt<<    {
        $@{logo}$files::logo.tmplt<< {
            $@{svg}$files::svg_container.tmplt<<
        },
        $@{spacer}$files::spacer.tmplt<<,
        $@{mushroom}$files::shroom.tmplt<<,
    },
    $@{logout}$files::logo.tmplt<<
}

*/


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
    section_parsing(all_skeletons) {
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

                data_parts = this.sequence_expansion(data_parts)
                data_parts = this.capture_parameters(data_parts,maybe_params)

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

    leaf_hmtl_directives(skeleton_src) {

        for ( let skel_def of Object.values(skeleton_src) ) {
            let sk_map = {}
            let skeleton = skel_def.skeleton
            for ( let step_entry of skeleton ) {
                step_entry = step_entry.replace('<<','')

                // now get its value depending on its tyle
                if ( step_entry.startsWith('html:') ) {
                    let html_map = base_patterns['html:']
                    let ky = step_entry.substring('html:'.length)
                    sk_map[step_entry] = html_map[ky]
                } else if ( step_entry.startsWith('verbatim::')  ) {
                    // crypto
                    let str = step_entry.substring(('verbatim::').length)
                    let hashed = crypto.hash('sha1',str)
                    
                    sk_map[`verbatim::${hashed}`] = str
                } else {
                    sk_map[step_entry] = ""
                }
            }
            skel_def.skeleton_map = sk_map
        }

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
        let transform_1 = this.section_parsing(all_skeletons)

        let script_stats = this.coalesce_scripts(transform_1)
        this.update_script_stats_usage(transform_1,script_stats)

        let occurence_partition = this.partition(script_stats)
console.dir(occurence_partition,{depth: 3})

        this.leaf_hmtl_directives(transform_1)

        let str = JSON.stringify(transform_1,null,4)
        await fos.write_out_string(this.top_level_parsed,str)
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

                break
            }
            case "page":
            case "assign":
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