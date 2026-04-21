const {PathManager} = require('extra-file-class')

const fos = require('extra-file-class')()


const TESTING = true

const {base_patterns_mod} = require('../lib/html_directives')
const {bundle_inclusion_transform,link_inclusion_transform} = require('../lib/bundle_directives')

let page_or_worker_context = {}   // maps skeletons "skeleton_src" to contexts for links in hmtl or javascript inclusion mechanisms

const crypto = require('crypto')


let ParseUtils = require('../lib/utils')
let parse_util = new ParseUtils()

/**
 * This class is made for organizing the code in this utility.
 * 
 * This class has to do with phase 1 operations.
 * 
 * Using the direction of an input file, such as generate.json in [websites]/template-configs/,
 * this method will read skeleton files describing the structure of web pages and output templates.
 * It will also attempt to move javascript files into collections for rollup into bundles to be loaded
 * via deferred loading into a browser like contexts.
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
        this.app_skel_vars = conf.app_skel_vars ? conf.app_skel_vars : {}
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
        this.var_spec_copy_pattern = new RegExp(/^\$\@\{(\w+)\}\$verbatim$/)
        this.var_spec_value_pattern = new RegExp(/^\$\@\{(\w+)\}\$\<\<(.+)$/)
        //
        this.var_spec_other_pattern = new RegExp(/^\$\@\{(\w+)\}\$(\w+)\:\:(.*)$/)

// ||||--------------------------build_param_tree $@{mushroom}$icons::mushroom-menu-icon.svg
// build_param_tree files::params::nav_bar_V.smplt $@{mushroom}$icons::mushroom-menu-icon.svg<<


        this.cross_type_directory = new RegExp(/^(\w+)\<(\w+)\>\:\:(.*)$/)
        this.executable_pattern = new RegExp(/\>\>.*\<\</)
        this.entry_starter = new RegExp(/^(\w+)\:\:/)
        this.sibling_type_directory_match = new RegExp(/^\[([\w-]+)\]\/(.*)$/)

        this.concerns_directory_redirect_match = new RegExp(/^\[(([\w-]+)\<([\w]+)\>)\]\/(.*)$/)

        this.start_of_list = new RegExp(/^\@list\<(\w+)\>\<\{/)

        this.ternary_check = new RegExp(/^(.+)\?(.+)\:(.*)/)
        this.var_pattern = new RegExp(/\@\{([\w\%]+)\}/g)
        this.var_set_expr_pattern = new RegExp(/\{([\w\=\+\-\d]+)\}/)

        this.basic_function_call_match = new RegExp(/f\@(\w[\w\d]*)\{(\w[\w\d]*)\}/)
        this.import_entry_match = new RegExp(/\$\$(\w+)\:\:.+\.\w+\<\</)

        this.entry_remap_map = {
            "files" : { "source" : "html", "type" : "tmplt"},
            "css" : { "source" : "css", "type" : "css"}
        }

        this.name_drops_db = {}
        //
        this.delay_file_loading_queue = []
        //
        this.tracking_skel_calc_usage = {}
    }


    /**
     * 
     * @param {string} project_dir 
     */
    set_project_directory(project_dir) {
        this.project_dir = project_dir
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
     * @param {string} script_line 
     * @returns 
     */
    script_specialization(script_line) {
        let after_def = script_line.split("<<")[1]
        after_def = after_def.trim()
        return after_def
    }


    /**
     * 
     * If a script has some variable from configuration.
     * Then, there should be a substitution variable that will be set
     * as a special case in the use of the skeleton.
     * 
     * The specialization will for the script to be inlined.
     * 
     * @param {string} script_line 
     * @returns {boolean}
     */
    script_no_bundle(script_line) {
        let after_def = this.script_specialization(script_line)
        if ( after_def.length ) return false
        return true
    }

    /**
     * 
     * @param {*} script_line 
     * @param {*} script 
     * @returns 
     */
    structural_substitution(script_line,script) {
        let after_def = this.script_specialization(script_line)
        if ( after_def[0] === '@' ) {
            let value = ""
            let config_var = after_def.substring(after_def.indexOf('{') + 1,after_def.lastIndexOf('}')-1)
            let dat_struct = this.get_data(config_var)
            if ( after_def[1] === '#' ) {
                value = 0
                if ( Array.isArray(dat_struct) ) {
                    value = dat_struct.length
                } else {
                    value = Object.keys(dat_struct).length
                }
            } else {
                //
            }
            script = script.replace(`{{${config_var}}}`,value)
        }
        return script
    }


    /**
     * For each concern, makes sure that the output directory exists under the directory for the concern
     * determined by the scheme estabished by the target's 'dir_form'
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
     * and are structured according to the configuration.
     * 
     * The configuration loaded from a file such as "generate.json" has fields describing directories
     * and concerns and global variables. Global variables reflect the specialization for a run on skeletons.
     * 
     * There is one field "outputs" which describes directories where templates and final renditions will be stored
     * for different concern/file pairings. Each element of the outputs has three main fields for grouping 
     * this information:
     * 
     * targets - description of output directory schemes and a list of a concerns (webstites/apps) that will use the outputs
     * skeletons - a map of out template names to 
     * name_parameters  -- variations on skeletal structure from a database of these structures, with defintions for 
     * final substitutions 
     * 
     * this method makes use of targets and skeletons
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
     * @returns {pair}
    */
    async load_skeletons() {
        //
        let outputs = this.outputs
        let all_skeletons = {}
        //
        for ( let ogroup of outputs ) {
            let skeletons = ogroup.skeletons    // skeletons mentioned in the ogroup
            ogroup.skels_processed = {}         // will get the unique skels in this ogroup and create a place to store their processed parts
            //
            for ( let [fky,file] of Object.entries(skeletons) ) {  // the field key is the desired output
                //
                let fpath = this.paths.compile_one_path(file)
                let p = all_skeletons[fpath]            // a skeleton absolute path name
                if ( p === undefined ) {
                    all_skeletons[fpath] = {
                        "original" : "",
                        "ops" : {                   // ops map
                        }
                    }
                }
                //
                if ( ogroup.skels_processed[file] === undefined ) {  // one for any of the selected skeletons (may select in duplicate)
                    let config_vars =  ogroup.targets.uses_config_vars
                    config_vars = (config_vars ? config_vars : "default")  // the skeleton ops apply to an ogroup
                    ogroup.skels_processed[file] = {        // allows to map from template to output
                        "ablsolute_path" : fpath,           // a key to the loaded data as well
                        "skel_vars_key" : config_vars,
                        "final" : ""        // final output not yet determined
                    }
                    all_skeletons[fpath].ops[config_vars] = ""  // on preparation across many entries retrievable from ogroup by:
                                                            // all_skeletons[ogroup.skels_processed[file].ablsolute_path][ogroup.skels_processed[file].skel_vars_key]
                }
            }
            //
            let tdir = ogroup.targets.dir_form
            ogroup.concerns_to_out_dirs = {}
            //
            for ( let crn of ogroup.targets.concerns ) {
                let crn_tdir = tdir.replace("@concern",crn)
                crn_tdir = crn_tdir.replace("@target",this.created_dir)
                ogroup.concerns_to_out_dirs[crn] = crn_tdir
            }
            //
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
            all_skeletons[skel_keys[i]].original = data_list[i]
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
     * @param {string} part_key 
     * @param {string} param_str 
     * @returns {object}
     */

// console.log("||||--------------------------build_param_tree",key_part)
// console.log("build_param_tree",part_key,param_str)

    async build_param_tree(part_key,param_str) {
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
//console.log("||||--------------------------build_param_tree",key_part)
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
                    easy_access_parse[extracted_var] = "%file%"
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
                } else if ( check = this.var_spec_copy_pattern.exec(key_part) ) {
                    //
                    let data =  ""
                    if ( rest.length ) {
                        let next = this.find_next(rest)
                        if ( next ) {
                            data = rest.substring(0,next)
                            rest = rest.substring(next)
                            data = data.substring(1,data.lastIndexOf('}'))
                        }
                    }
                    let extracted_var = check[1]
                    easy_access_parse[extracted_var] = "%string%"
                    var_tree[extracted_var] = {
                        "file"  : false,
                        "tree"  : false,
                        "data"  : data
                    }
                    //
                } else if ( check = this.var_spec_value_pattern.exec(param_str) ) {
                    let data =  ""
                    if ( rest.length ) {
                        let next = this.find_next(rest)
                        if ( next ) {
                            data = rest.substring(0,next)
                            rest = rest.substring(next)
                            data = data.substring(1,data.lastIndexOf('}'))
                        }
                    }
                    //
                    let extracted_var = check[1]
                    data = check[2]
                    let val_type = isNaN(parseInt(data)) ? "%string%" : "%number%"
                    easy_access_parse[extracted_var] = val_type
                    var_tree[extracted_var] = {
                        "file"  : false,
                        "tree"  : false,
                        "data"  : data
                    }
                    //
                } else {
                    if ( rest.length ) {
                        let next = this.find_next(rest)
                        if ( next ) {
                            rest = rest.substring(next)
                        }
                    }
                    
                    check = this.var_spec_other_pattern.exec(key_part) 
                    if ( check = this.var_spec_other_pattern.exec(key_part) ) {
                        let extracted_var = check[1]
                        let path_finder = check[2]
                        let the_file = check[3]

                        let data = ""
                        let locus = this.top_dir_locations[path_finder]

                        if ( locus ) {
                            if ( the_file.indexOf('::') > 0 ) {
                                the_file = the_file.substring(the_file.indexOf('::') + 2)
                            }
                            let file_path = `${locus}/${the_file}`
                            data = await fos.load_data_at_path(file_path)
                        }
                        var_tree[extracted_var] = {
                            "file"  : the_file,
                            "tree"  : false,
                            "data"  : data
                        }
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
            let a_tree = await this.build_param_tree(part_key,param_block)
            for ( let ky in a_tree ) {
                sub_tree[ky] = a_tree[ky]
            }
        }
        return rest
    }


    /**
     * remove syntax markers that must not occur in the final output
     * 
     * @param {string} str 
     * @returns {string}
     */
    clean_verbatim(str) {
        str = str.trim()
        if ( str[0] === '{' ) {
            str = str.substring(1)
            let i = str.lastIndexOf('}')
            if ( i > 0 ) {
                str = str.substring(0,i)
            }
        }
        return str
    }

    /**
     * 
     * This method is a map call on the array, that filters 'files::loop::' into parsing operations and returns all else 
     * in its original state.
     * 
     * There are two types of loop structure supported, ranges and lists.
     * 
     * The range construct maps the input into an expanded list of elements indexed from start to end of the range.
     * Before returning, this method flattens the list to incorporate the exanded range. The range construct is identified
     * by a pair within backets `<range_pair>`, where `range_pair` is a comma separated sequence of two numbers,
     * lower bound to upper bound.
     * 
     * The list construct provides a variable (expected to be used in the list expansion file) instead of a range.
     * That is, instead of a `range_pair` inside brackets `<>`, there will be a variable name, e.g. '<el>', where
     * 'el' would mean an element of the list. The list construct will provide a list in a JSON parseable structure 
     * listed after '<<', the end of step specifier symbol. The struct must be a complete structure prior to the next 
     * '$$' in the table.  The structure will be held for later use in the `maybe_params` structure. A 'part key' will
     * be used to index the data list for this sort of element. (Note: the part key will be a sub skeleton that takes 
     * a list as input.)
     * 
     * Note: this method stops short of loading subtemplate files, so the list construct will not expand the list.
     * 
     * Note: Sequence expansion conceptually assigns space to a sequence of elements in markup. These are structural changes,
     * expansions, of a skeleton. These are step elements that claim space, but do not produce a string to be input to anything.
     * These space grabbers can take input from items that produce strings. (See parameters for string producing items).
     * 
     * @param {Array} data_parts 
     * @param {object} maybe_params 
     * @returns {Array} 
     */
    sequence_expansion(data_parts,maybe_params) {
        data_parts = data_parts.map((a_part) => {
            if ( a_part.indexOf("files::") === 0 ) {
                if ( a_part.indexOf("files::loop::") === 0 ) {
                    let range = {
                        lb: 0,
                        ub: 0
                    }
                    a_part = parse_util.remove_spaces(a_part)
                    a_part = parse_util.remove_white(a_part)
                    // RANGE
                    if ( this.has_range_expr(a_part.substring("files::loop::".length),range) ) {
                        let replacer = `<${range.lb},${range.ub}>`
                        let lines = []
                        for ( let i = range.lb; i <= range.ub; i++ ) {
                            let this_part = a_part.replace(replacer,`${i}`)
                            this_part = this_part.replace("::loop","")  // removes the loop specification leaving behind other types (e.g. calc)
                            lines.push(this_part)
                        }
                        return lines
                    } 
                } else if ( a_part.indexOf("files::list::") === 0 ) {
                    let var_holder = []
                    if ( this.has_list_expr(a_part.substring("files::list::".length,a_part.indexOf('[')),var_holder) ) {
                        // ELEMENTS
                        let parts = a_part.split('<<')
                        let part_key = parts.shift()
                        part_key = part_key.replace("::list","")
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
            //
            return a_part
        })
        data_parts = parse_util.flatten(data_parts)
        return data_parts
    }


    /**
     * 
     * @param {string} a_part 
     * @returns {boolean}
     */
    has_verbatim_params(a_part) {
        return a_part.indexOf('$verbatim') > 0
    }

    /**
     * 
     * @param {string} a_part 
     * @param {object} verbatim_blocks 
     * @returns 
     */
    block_verabtim_parameters(a_part,verbatim_blocks) {
        let var_lines = a_part.split("$@{")
        let n = var_lines.length
        for ( let l = 1; l < n; l++ ) {
            let maybe_verbatim = var_lines[l]
            if ( this.has_verbatim_params(maybe_verbatim) ) {
                let verby = maybe_verbatim.split("<<")
                let vdata = verby[1].trim()
                let [s,e] = [0,0]
                if ( vdata[0] === '{' ) {
                    s = 1
                    e = vdata.lastIndexOf('}')
                    vdata = vdata.substring(s,e)
                }
                let ky = `v${l}`
                verbatim_blocks[ky] = vdata.trim()
                var_lines[l] = maybe_verbatim.replace(vdata,`@{${ky}}`)
            }
        }
        return var_lines.join("$@{")
    }

    /**
     * 
     * @param {string} a_part 
     * @param {object} verbatim_blocks 
     * @returns {string}
     */
    unblock_verabtim_parameters(a_part,verbatim_blocks) {
        for ( let ky in verbatim_blocks ) {
            let data = verbatim_blocks[ky]
            a_part = a_part.replace(`@{${ky}}`,data)
        }
        return a_part
    }

    /**
     * This method is a map call on the array, that filters 'files::params::' into parsing operations and returns all else 
     * in its original state.
     * 
     * A custom sytnax is used for the passing of parameters to a subskeleton and should occur after the end of step specifier symbol, '<<'.
     * The parameter specification looks a little bit like JSON, but it is not.
     * The specifier is demarcated by braces, '{}', and within the braces, sub-step specifiers are given. 
     * The sub-step has similar structure to a step, but instead of starting with a 'start of section' symbol, i.e. "$$", it starts
     * with variable assignment of the sub-section. The variable assignment step indicator includes a subsitution variable identifier
     * between the '$'s of '$$' pair. For example, the form `$@{lr_div}$` will assign the rest of the step specifier to the variable
     * 'lr_div` to be found in the sub template file requiring the variables.
     * 
     * The variable assigned steps are listed sequentially for the parameterized sub template. Each variable assigned step
     * may be any one of the step types indicating a file to be loaded into skeletons. As such the parameterized step
     * may be recursive (maximally what is typed into the top level skeleton). So, a tree of parameterizations is constructed 
     * and returned.
     * 
     * Note: Parameter files demand string input from a calling file. The step version takes up structural space, while 
     * the `variable assignment step indicator` version produces a string for input.
     * 
     * @param {Array} data_parts 
     * @param {object} maybe_params 
     * @returns {Array}
     */
    async capture_parameters(data_parts,maybe_params) {

        let promisory = data_parts.map(async (a_part) => {  // map and return an array of promises
            if ( (a_part.indexOf("files::") === 0)  || (a_part.indexOf("script::") === 0)  ) { ///
                if ( (a_part.indexOf("files::params::") === 0)  || (a_part.indexOf("script::params::") === 0) ) {  // 
                    let verbatim_blocks = false
                    if ( this.has_verbatim_params(a_part) ) {
                        verbatim_blocks = {}
                        a_part = this.block_verabtim_parameters(a_part,verbatim_blocks)
                    }
                    a_part = parse_util.remove_white(a_part)
                    if ( verbatim_blocks !== false ) {
                        a_part = this.unblock_verabtim_parameters(a_part,verbatim_blocks)
                    }
                    let parts = a_part.split('<<{')
                    let part_key = parts.shift()
                    let part_def = parts.join('<<{')
                    //
                    maybe_params[part_key] = await this.build_param_tree(part_key,part_def.substring(0,part_def.lastIndexOf('}')))
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
     * @param {Array} data_parts 
     * @returns {Array}
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
     * 
     * @param {*} data_parts 
     * @returns 
     */
    pull_out_css(data_parts) {

        let just_files = data_parts.filter((a_part) => {
            return (a_part.indexOf("css::") === 0)
        })
        return just_files.map((a_part) => {
            return ( a_part.substring("css::".length) )
        })
    }


    /**
     * pull_out_script
     * @param {Array} data_parts 
     * @returns {Array}
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
     * 
     * @param {Array} data_parts 
     * @returns {Array}
     */
    pull_out_bundles(data_parts) {
        let just_bundles = data_parts.filter((a_part) => {
            return (a_part.indexOf("bundle::") === 0)
        })
        return just_bundles.map((a_part) => {
            return ( a_part.substring("bundle::".length) )
        })
    }


    /**
     * pull_out_html_directives
     * @param {Array} data_parts 
     * @returns {Array}
     */
    pull_out_html_directives(data_parts) {
        let just_html_d = data_parts.filter((a_part) => {
            return (a_part.indexOf("html:") === 0)
        })
        return just_html_d
    }


    /**
     * Returns an esimation of the size of the object.
     * 
     * @param {object|string|Array} o_value 
     * @returns {number}
     */
    figure_size(o_value) {
        if ( typeof o_value === "string" ) {
            return o_value.length
        } else if ( Array.isArray(o_value) ) {
            return o_value.length
        } else if ( typeof o_value === "object" ) {
            return Object.keys(o_value).length
        }
        return 0
    }

  
    /**
     * 
     * @param {Array} data_parts -- array of sections describing file to include along with alfterations related to configuration
     * @param {string} which_config_vars 
     * @returns {Array}
     */
    config_var_transformations(data_parts,which_config_vars) {
        //
        let vars = this.app_skel_vars[which_config_vars]  // a single key `uses_config_vars` from the header identifies the variable/value group for the particular skeleton
        if ( vars && (typeof vars === "object")) {
            for ( let [vname,value] of Object.entries(vars) ) {
                let o_value = value // original
                if ( typeof value !== "string" ) {
                    value = JSON.stringify(value)
                }
                let finder = `@!{${vname}}`
                let count_finder = `@#{${vname}}`
                //
                data_parts = data_parts.map((el) => {       // alter the skeleton (an update)
                    if ( el.indexOf(finder) > 0 ) {
                        el = el.replace(finder,value)
                    }
                    if ( el.indexOf(count_finder) > 0 ) {
                        el = el.replace(count_finder,this.figure_size(o_value))
                    }
                    return el
                })
                //
            }
        }
        //
        return data_parts
    }


    /**
     * 
     * @param {object} data_parts 
     * @returns 
     */
    async skeleton_parts_extraction(data_parts) {
        let files = []
        let css = []
        let scripts = []
        let bundles = []
        let maybe_params = {}
        //
        // The defaults can update the basic skeleton structure prior to skeleton processing (parsing, evaluating)
        // structure expansions of parts that will be replicated 
        data_parts = await this.sequence_expansion(data_parts,maybe_params)
        // structure selected by operating on parameters specifically evaluated by configuration assignments
        data_parts = await this.capture_parameters(data_parts,maybe_params)
        //
        files = this.pull_out_files(data_parts)  // look for the files that will be expanded beneath the top skeleton
        css = this.pull_out_css(data_parts)  // look for the files that will be expanded beneath the top skeleton
        scripts = this.pull_out_script(data_parts) // pull out script files (remaining after bundle preparation)
        bundles = this.pull_out_bundles(data_parts)
        //
        return [data_parts,files,css,scripts,bundles,maybe_params]
    }


    /**
     * 
     * Walks through the map of all loaded skeletons, parsing them into sections.
     * Sections are demarcated by the beginning of section symbol '$$'.
     * This method splits the string made from the skel file data (mapped by a key in all_skeletons) into sections,
     * splitting on '$$', and processes each section separately for structure only.
     * 
     * This method parses each skeleton file by first creating an array of sections.
     * After the first split, the sections array is the skeleton as a list of parseable file specifications and uses.
     * 
     * This method operates on each section in order to determine if further primary parsing is needed. 
     * In some cases, the sections describe loops or the inclusions of files with parameters. This method will expand loops,
     * and create data structure to line up parameters with future evaluations, handled by methods called after this one.
     * 
     * The first alteration of the sections is a variable substitution.
     * The first section of the file is often a specialization of the project configuration file read in by the main command line.
     * The configuration may specify a set of variable subsitutions that may be performed prior to any other section processing.
     * This method updates each section (elements in `data_parts`) with a variable subsitution.
     * 
     * After taking care of any variable substitutions, this method removes comments from the sections.
     * 
     * Next, the loops and parameters are processed. (note `maybe_params` is an empty object used to capcture the parsing data)
     * These processes may alter the skeletal structure by altering the array `data_parts`. In the case of loops, elements 
     * may be added to the array.  In the case of parameters, the section is returned with all spaces removed, and the 
     * structure `maybe_params` will contain an entire parameter tree, needed for passing values down into a sub-skeleton template.
     * 
     * Finally, this method makes arrays of markup imports ('files') and language imports ('scripts') for later access and processing.
     * 
     * All the arrays and structures created for a skeleton file are returned as part of a map of the file names to the 
     * a structure with a field for each one of the arrays or structures.
     * 
     * `skel_to_concerns` maps a skeleton file to a list of concerns that use it. 
     * Each concern will be identified in an ogroup, where the configuration `app_skel_vars` entry
     * will be be called out for the variables values used in calculating the skeleton for the concerns 
     * sharing the ogroup. The ogroup.targets.uses_config_vars will identify the variable evaluations 
     * to apply to the skeletons they use.
     * 
     * 
     * @param {object} all_skeletons - `skel file path` to file contents.
     * @param {object} skel_to_concerns - allows for determining splits due to structure preferences
     * @returns {object} - a map of `skel file path` to objects where each object contains parsing data structures
     */
    async section_parsing(all_skeletons) {
        let section_data = {}
        //
        for ( let [sky,data_m] of Object.entries(all_skeletons) ) { // data is a string (the contents of the skeleton file)
            // 
            let data = data_m.original
            // data_parts an array
            let data_parts = data.split('$$')   // all sectional definitions start with $$ (split makes leading section empty)
            let no_data = (data_parts.length < 2)  //
            if ( no_data ) continue
            //
            section_data[sky] = {}
            let skel_ops = data_m.ops
            //
            data_parts.shift() // the first element is expected to be empty or white space or some comment (throw away)
            data_m.shifted_data = data_parts
            //
            data_parts = data_parts.map((el) => { return parse_util.clear_comments(el.trim()).trim() })
            //
            //
            let def_check =  data_parts[0]
            let def_defaults = false
            if ( def_check.indexOf("defs:") === 0 ) {  // if present, this becomes a structure.
                def_defaults = def_check
                data_parts.shift()  // will process defaults
                data_m.shifted_data = data_parts
                //
                data_parts = [].concat(data_parts)  // make a copy
                //
                try {
                    def_defaults = JSON.parse(def_defaults.substring("defs:".length))
                } catch(e) {
                    def_defaults = undefined
                }
                // make a default entry for this skeleton 
                if ( def_defaults ) {       // defaults from the skeleton file $$defs
                    let cvars_ky = def_defaults?.uses_config_vars  // a name found in a configuration
                    if ( typeof cvars_ky === "string" ) {
                        //
                        // use configuration variable values to put in values for skeleton level variables
                        data_parts = this.config_var_transformations(data_parts,cvars_ky)
                        // next expand sequences and get separate imports for markup and script
                        let [dps,files,css,scripts,bundles,maybe_params] = await this.skeleton_parts_extraction(data_parts)
                        data_parts = dps
                        section_data[sky]["defaults"] = {
                            "defaults" : def_defaults,
                            "final" : {
                                "markup" : false,
                                "scripts" : false
                            },
                            "skeleton" : data_parts,
                            "files" : files,
                            "css" : css,
                            "scripts" : scripts,
                            "bundles" : bundles,
                            "parameterized" : maybe_params
                        }
                        //
                    }
                }
            }

            // all the ops assigned to this skeleton from configuration...
            for ( let op_ky in skel_ops) {
                if ( section_data[sky][op_ky] === undefined ) {
                    //
                    data_parts = data_m.shifted_data
                    // 
                    // use configuration variable values to put in values for skeleton level variables
                    data_parts = this.config_var_transformations(data_parts,op_ky)
                    // next expand sequences and get separate imports for markup and script
                    let [dps,files,css,scripts,bundles,maybe_params] = await this.skeleton_parts_extraction(data_parts)
                    data_parts = dps
                    section_data[sky][op_ky] = {
                        "defaults" : def_defaults,
                        "final" : {
                            "markup" : false,
                            "scripts" : false
                        },
                        "skeleton" : data_parts,
                        "files" : files,
                        "css" : css,
                        "scripts" : scripts,
                        "bundles" : bundles,
                        "parameterized" : maybe_params
                    }
                    //
                }
            }
        }

// console.dir(section_data,{depth : 6})
// process.exit(0)

        return section_data  // return the whole table
    }


    /**
     * 
     * Outputs to each concern the variable forms table, yielding default substitutions.
     * If the developer chooses to change these before final template generation he may.
     * 
     * 
     * Does not output an entire DB for each page that is being generated. 
     * This outputs a selection for each template. 
     * 
     * 
     *
     * `
        "name_parameters" : {
            "db" : "[names]/name-drop.db",
            "parameter_values" : "[websites]/@concern/@target/name-drop.json",
            "index.tmplt" : [ "contact_box", "about_box", "topicBox_<1,3>", "thankyou_box", "register" ],
            "login.tmplt" : [ "contact_box", "thankyou_box", "login" ]
        }
        `
     * 
     */
    async name_parameters_output() {
        //
        let outputs = this.outputs
        for ( let ogroup of outputs ) {
            //
            let name_parameters = ogroup.name_parameters ? true : false
            if ( name_parameters ) {
                let concerns = ogroup.targets.concerns
                //
                for ( let concern of concerns ) {
                    name_parameters = Object.assign({},ogroup.name_parameters)  // actually its an object
                    let drops_db = this.name_drops_db       // The template db that allows for specializations to be figured for the concerns output
                    if ( name_parameters.db ) {
                        let name_db = this.paths.compile_one_path(name_parameters.db)
                        drops_db = await this.load_name_drops_db(name_db)       // loading this each time (useful after specialization)
                        delete name_parameters.db
                    }
                    let output = name_parameters.parameter_values ? this.paths.compile_one_path(name_parameters.parameter_values) : false
                    if ( output ) {
                        output = output.replace('@concern',concern)
                        output = output.replace("@target",this.created_dir)
                        delete name_parameters.parameter_values  // delete one more non file name key
                        let value_object = {}   // collect for each template
                        for ( let [tmplt_ky,db_keys] of Object.entries(name_parameters) ) {
                            if ( tmplt_ky === 'db' ) continue               // added this for clarity during validation
                            if ( tmplt_ky === 'parameter_values' ) continue // added this for clarity during validation
                            if ( tmplt_ky.indexOf('.tmplt') < 0 ) continue  // handle case not planned for at this time
                            // tmplt_ky has to be the name of a tempalte file
                            value_object[tmplt_ky] = {}  // vars we are getting for this template
                            for ( let form_name of db_keys ) {  // maybe it's a form or some display
                                value_object[tmplt_ky][form_name] = drops_db[form_name]
                            }
                        }
                        output = this.paths.resolve(output)
                        await fos.write_out_pretty_json(output,value_object,4)
                    }
                }
                //
            }
            //
        }
        //
    }




    /**
     * 
     * This is for gathering stats about script usage.
     * 
     * @param {object} transform_1 
     * @returns {object}
     */
    coalesce_scripts(transform_1) { // now has a nother level (concerns)
        //
        let scripts_occurences = {}
        for ( let op_map of Object.values(transform_1) ) {
            for ( let dpart of Object.values(op_map) ) {
                let scripts = dpart.scripts
                if ( scripts.length ) {
                    for ( let script of scripts ) {
                        let p = scripts_occurences[script]
                        scripts_occurences[script] = p ? p + 1 : 1
                    }
                }
            }
        }
        //
        return scripts_occurences
    }


    /**
     * 
     * @param {object} sorted_stats 
     * @returns {object}
     */
    partition_stats(sorted_stats) {
        let partitions = []
        //
        let bdiff = Object.values(sorted_stats)
        let n = bdiff.length
        let diffs = []
        for ( let i = 0; i < n-1; i++ ) {
            let v0 = bdiff[i]
            let v1 = bdiff[i+1]
            diffs.push(v1-v0)
        }
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
        return partitions
    }


    /**
     * 
     * @param {object} script_stats 
     * @param {number} threshold 
     * @returns {object}
     */
    partition(script_stats) {

        let sorted_stats = {}
        //
        // sort by key prefix to get a grouping of functional parts
        sorted_stats = parse_util.key_sort(script_stats,(ky) => {
            let slash = ky.indexOf('/')
            if ( slash > 0 ) {
                let tester = ky.substring(0,ky.indexOf('/'));
                return tester
            } else return ky
        })
        //

        // now put common prefixes into buckets
        let prefix_buckets = {}
        let bucket_keys = Object.keys(sorted_stats)
        for ( let ky of bucket_keys ) {
            if ( ky[0] === '[' ) {
                let bucket_ky = ky.substring(0,ky.indexOf('/'))
                let bucket = prefix_buckets[bucket_ky]
                if ( bucket === undefined ) {
                    bucket = {}
                    prefix_buckets[bucket_ky] = bucket
                }
                bucket[ky] = sorted_stats[ky]
            } else {
                let bucket = prefix_buckets["[script]"]
                if ( bucket === undefined ) {
                    bucket = {}
                    prefix_buckets["[script]"] = bucket
                }
                bucket[ky] = sorted_stats[ky]
            }
        }
        // before partitioning the sorted stats buckets, 
        // make sure they are sorted by score
        //
//console.log("sorted_stats")
        let nested_partitions = {}

        for ( let [ky,bucket] of Object.entries(prefix_buckets) ) {
            //
            let keys = Object.keys(bucket)
            keys.sort((k1,k2) => {
                let v1 = bucket[k1]
                let v2 = bucket[k2]
                return v1 - v2
            })
            let sorted_bucket = {}
            for ( let bky of keys ) {
                sorted_bucket[bky] = bucket[bky]
            }
//console.log(ky)
//console.dir(sorted_bucket)
            //
            nested_partitions[ky] = this.partition_stats(sorted_bucket)
        }
        //

        return nested_partitions
    }


    /**
     * Partitions files into directories for later use in putting code into 
     * bundles, which will be requested in headers.
     * 
     * prep_script_directories is one of the first operations in skeleton skeleton_parsing.
     * 
     * Each skeleton lists a number of scripts that make resulting applications work in general.
     * 
     * Previously, all of the scripts were placed into the HTML file. But, that results in inefficient loading
     * and management.
     * 
     * @param {object} partitions 
     */
    async prep_script_directories(partitions) {

        for ( let pky in partitions ) {
            console.log("prep_script_directories",pky)
            if ( pky.indexOf(">") > 1 ) {
console.log("\tskipping")
            } else {
console.log("DATA")
                let bare_ky = pky.replace('[','').replace(']','')
                let script_src_dir = this.top_dir_locations[bare_ky]
                console.log("script source:  ",script_src_dir,">> bare_ky:: ",bare_ky)
                let script_grouping_dir = `${this.project_dir}bundle_src/${bare_ky}`
                script_grouping_dir = this.paths.resolve(script_grouping_dir)
                console.log("script output: ", script_grouping_dir)
                await fos.ensure_directories(script_grouping_dir)
                let subdr = 'A'
                for ( let file_list of partitions[pky] ) {
                    if ( file_list.length ) {
                        let part_dir = `${script_grouping_dir}/${subdr}`
                        await fos.ensure_directories(part_dir)
                        for ( let file of file_list ) {
                            file = file.replace(`${pky}/`,'').replace('<<','')
                            let fpath = `${part_dir}/${file}`
                            let spath = `${script_src_dir}/${file}`
                            if ( file.indexOf('/') > 0 ) {
                                console.log("ENSURE:",part_dir)
                                let parts = file.split('/')
                                parts.pop()
                                parts = parts.join('/')
                                await fos.ensure_directories(`${part_dir}/${parts}`)
                            }
                            console.log(spath)
                            console.log(fpath)
                            await fos.file_copier(spath,fpath)
                        }
                        subdr = parse_util.next_char(subdr)
                    }
                }
            }
        }
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
                if ( entry_type === 'tjs' ) entry_type = "script"
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
                        return "not_handled - a"
                    }
                }
            }
            file_path = `${file_path}/${file_name}`
            let data = await fos.load_data_at_path(file_path)
            if ( data ) {
                data = parse_util.clear_comments(data)
            } else {
                data = "NO DATA"
            }
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
        return "not hanlded - b"
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
                let atype = ""
                if ( occur.indexOf('%') > 0 ) {
                    atype = occur.split('%')[1]
                    atype = '%' + atype + '%'
                }
                eve_results[occur] = atype
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
     * Handles the inclusion of recursive scripts call by skeletons and templates or s-templates
     * Some sub files may start with parameter definitions or element definitions
     * Others may have executables
     * 
     * This method pulls out the definitions which must be associated with values, structures or basic values.
     * The final roster of executable, variables, parameter defs, list element defs, are returned in a structure
     * which will be used later during an evaluation phase.
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
        let _is_loop = false

        let lines = []
        if ( data.startsWith("@params<") ) {   // will be at the top of a file (parameter defs for matching calling skeleton)
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
        } else if ( this.list_start(data,carrier) ) {  // will be at the top of file for matching list element components (one at a time)
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
            _is_loop = true
            params_def._var_name = carrier.var
            //
        } else {
            // no parameter or list defs, so just pull in any variables, schemes and the like 
            // that may be needed to decide on final structure or explicit values 
            // when a template is being generated
            let executables = this.extract_excecutables(data)
            params_def = this.errant_variable_extraction(params_def,data)
            return { _is_loop, params_def, executables }
        }

        // parameters or loop assignments have been found, so 
        // finish the collection of variables and possible executable operations.
        params_def = this.errant_variable_extraction(params_def,data)
        //
        let executables = []
        if ( lines.length ) {
            let rest = lines.join('\n')
            executables = this.extract_excecutables(rest)
        }
        // 
        return { _is_loop, params_def, executables }
    }



    /**
     * A ternary conditional is a type of executable 
     * with a means for picking a particular path of construction.
     * This method creates the structure that evaluation may use
     * to yield a particular structure given the setting of 
     * configuration variables.
     * @param {string} parseable 
     * @param {object} exec_report 
     * @returns {boolean}
     */
    ternary_conditional(parseable,exec_report) {

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
     * builds up the lists of executables and imports that are called out in a file.
     * 
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
        //
        if ( entry_data?.key_values ) {
            //
            for ( let fcall of Object.values(entry_data.key_values) ) {
                if ( (fcall === "f@incr{$}") || (fcall === "f@init{$}") ) {
                    continue
                }
                let parse_call = this.basic_function_call_match.exec(fcall)
                if ( parse_call ) {
                    return true
                }
            }
            //
        } else {
            // console.log("has_calc")
            // console.dir(entry_data)
        }
        //
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
     * @param {string} sk_key 
     * @param {string} step_entry 
     */
    add_tracking_for_calc(sk_key,step_entry) {
        let track_ky = step_entry.substring(step_entry.lastIndexOf(':') + 1,step_entry.indexOf("${"))
        let calc_entries = this.tracking_skel_calc_usage[sk_key]
        if ( !calc_entries ) {
            calc_entries = {}
            this.tracking_skel_calc_usage[sk_key] = calc_entries
            calc_entries[track_ky] = 0
        }
        if ( calc_entries[track_ky] === undefined ) {
            calc_entries[track_ky] = 0
        }
        calc_entries[track_ky]++
    }


    /**
{
    $@{scroll_section_count}$::@#{groups}
}
     * 
     * @param {string} params 
     */
    evaluation_map(params) {
        params = params.substring(params.indexOf('{')+1,params.lastIndexOf('}')).trim()
        let parlist = params.split('\n').map( el => el.trim() )
        parlist = parlist.map( (el) => {
            return el.split('<<')
        })
        let evals = {}
        for ( let ev_pair of parlist ) {
            let [ky_form, val] = ev_pair
            let ky = ky_form.replace('$@{',"")
            ky = ky.replace('}$',"")
            if ( (val.indexOf('@!{') === 0) || (val.indexOf('@#{') === 0) ) { val = '0' }
            evals[ky] = val
        }
        return evals
    }


    /**
     * 
     * @param {object} script_spec 
     */
    early_evaluations(script_spec) {
        // @params<{scroll_section_count : %number%}>
        let data = script_spec.data

        data = data.substring(data.indexOf("@params<{") + "@params<{".length)
        data = data.substring(data.indexOf('}>') + 2)
        script_spec.data = data.trim()
        
        this.conditionless_evaluations_substitution(script_spec)
    }


    /**
     * Builds the data structures describing the entry 
     * updates sk_map, where data stuctures are stored for a particular skeleton.
     * 
     * This method parses a skeleton file, creating as a result a data structure that captures the intent of 
     * structural defition which may be some sort of markup (e.g. HTML).  The output of this method may be
     * used subsequently by methods that prepare a template in the markup language.
     * 
     * Need to add $$bundle section
     * 
     * A skeleton file is broken down into sections. Each section is demarcated by a start of section token
     * which indicates section type as well as some parameters that may go into the calculation of the section 
     * structure.
     * 
     * A section starts with syntactic separator `$$`.
     * The '$$' symbol must be followed by a type directive, which is then followed by one or two ':' (colons).
     * One colon indicates a named element of the chosen markup language which will be substituted by the tool.
     * Two colons indicates that the type directive and information in the section will be part of some calculation 
     * specified by the section that is used to generate the final template markup. In many cases, the calculation 
     * indicates that a file should be loaded, where the file is a pre-template which will structurally expanded 
     * according to the section parameters.
     * 
     * Following colons are further speciations of the section indicating parametarization and actions. 
     * Each of these has a type name and may be followed by colons as well. The final specifier must be followed by 
     * the syntactic indicator `<<`. This is an end of directive indicator. This line terminator may be followed by 
     * more information encapsulated within braces '{','}'
     * 
     * The information in braces may specify calculations, parameter substitutions, or loop calculations.
     * 
     * Information after the final top level brace '}' and the start of the next section '$$' is likely to be ignored 
     * or treated as comments.
     * 
     * 
     * Adds fields skeleton_map and incrementer_set
     * 
     * 
     * Here are the type of sections supported by the program to date:
     * 
     * $$defs::         -- These are variable definitions and overrides relative to the configuration for the run
     * $$bundle::       -- One of these indicates a bundled script that needs to be included in the header as a deferred file.
     * $$html:          -- These are HTML markups indicating start of larger sections such as hearders, bodies, scripts, style, etc.
     * $$css::          -- The file name following this is a css file stored in the css directory of the alphas
     * $$files::        -- These are files to be found in the directory for the markup, e.g. html for HTML
     * $$files<*>::     -- These are files of a different type than the markup by in the same directory. For instance '*' may be replace with 'js' 
     * $$script::       -- These are files in the scripting language. Files that remain in a skeleton after preprocessing for bundling will be written into the template.
     * $$verbatim::     -- A section that will be left alone and included precisely as is
     * $$template::     -- Similar to verbatim, but it expected to contain variables for use in substitutions, some of which may be files loaded recursively
     * $$icon::
     * 
     * The $$files:: section may either be a simple directive indicating a file to put into the place of the file, or it may be 
     * a directive indicating how a file will be used:
     * 
     * $$files::|file path|<<
     * $$files::params::|file path|<<{|parameter descriptor|}
     * 
     * $$files::calc::|file path|<<${|calculation code|}
     * $$files::calc::|file path|<<${|calculation code|}
     * 
     * $$files::calc::contact_box<<${box_i=100}  -- this is an example of a calculation that initializes a variable
     * $$files::calc::another_box<<${box_i++}  -- this is an example of a calculation that advances a variable
     * 
     * $$files::loop:: -- Loops cause sections of markup to be generated in number, sequentially and may be iterates of a loop index of lists of elements
     * 
     * $$files::loop::elements::|file path with an element indicator, e.g. '<el>' |<<${|an expression itemizing loop elements|}
     * $$files::loop::calc::|file path with an index range, e.g. '<start,stop>'|><<${ a calculation advancing the loop index }
     * 
     * $$javascript:start_worker<<
     * $$javascript:end_worker<<
     * 
     * // the following is a `skel_def` ::
     * `{
            "defaults" : def_defaults,
            "final" : {
                "markup" : false,
                "scripts" : false
            },
            "skeleton" : data_parts,
            "files" : files,
            "scripts" : scripts,
            "bundles" : bundles,
            "parameterized" : maybe_params
        }`
     * 
     * @param {object} skeleton 
     * @param {object} sk_map 
     * @param {object} incrementer_set 
     */
    async build_entry_parsing(sk_key,skeleton,skeleton_src,sk_map,incrementer_set) {
        let lang_spec_count = 0
        for ( let step_entry of skeleton ) {
            step_entry = step_entry.replace('<<','')
            // now get its value depending on its tyle
            // HTML
            if ( step_entry.startsWith('html:') ) {  // handle the import of html snippets that start parts of the file
                lang_spec_count++
                let html_map = base_patterns_mod['html:']
                let ky = step_entry.substring('html:'.length)
                step_entry = step_entry.replace('html:',`html(${lang_spec_count}):`)
                sk_map[step_entry] = html_map[ky]
            // OTHER THAN HTML
            } else if ( this.is_language_section_control(step_entry) ) {  // a generalization of html: for later
                lang_spec_count++
                let lang_key = this.extract_lang_controller_key(step_entry)
                let lang_map = base_patterns_mod[lang_key]
                let ky = step_entry.substring(lang_key.length)
                step_entry = step_entry.replace(lang_key,`${lang_key}(${lang_spec_count}):`)
                sk_map[step_entry] = lang_map[ky]
            // BUNDLE - a link definition (CDN connection perhaps)
            } else if ( step_entry.startsWith('bundle::') ) {     // a bundled file -- used to generate the <link deferred... construct
                let str = step_entry.substring(('bundle::').length)
                let hashed = crypto.hash('sha1',str)        // cryp]==to
                sk_map[`bundle::${hashed}`] = bundle_inclusion_transform(str,page_or_worker_context[skeleton_src])
            // LINK - a link definition (possibly with compression)
            } else if ( step_entry.startsWith('link<') ) {     // a bundled file -- used to generate the <link deferred... construct
                let str = step_entry.substring(('link').length)
                let hashed = crypto.hash('sha1',str)        // cryp]==to
                sk_map[`link::${hashed}`] = link_inclusion_transform(str,page_or_worker_context[skeleton_src])
            // JAVASCRIPT -- sepcial directives for JavaScript in special modules, workers, etc.
            } else if ( step_entry.startsWith('javascript:')) {
                let str = step_entry.substring(('bundle::').length)
                sk_map[str] = ""   // for now they just disappear
            // VERBATIM -- text does not change
            } else if ( step_entry.startsWith('verbatim::') ) {     // parts of the file to leave alone and include in the final
                let str = step_entry.substring(('verbatim::').length)
                let hashed = crypto.hash('sha1',str)        // crypto
                sk_map[`verbatim::${hashed}`] = this.clean_verbatim(str)
            // ELSE
            } else {
                let entry = this.shared_entries[step_entry]
                if ( entry && typeof entry === "object" ) {     // previously created informaton -- just copy it
                    sk_map[step_entry] =  structuredClone(entry)
                } else {
                    // FILES with operations -- resulting in targeted markdown in template files
                    if ( step_entry.startsWith('files::') || step_entry.startsWith('files<') ||step_entry.startsWith('css::') ) {
                        // FILES::CALC - custom calculation for file use
                        if ( step_entry.startsWith('files::calc::') ) {
                            //
                            sk_map[step_entry] = "name"  // the default is to indicate that the entry names a type of section
                            //
                            if ( step_entry.indexOf("_<") < 0 ) {  // looking for a specific syntax associated with a file name
                                // this syntax tells processing that a range will be used in replicating a region
                                let var_set_expr = ""
                                let db = this.name_drops_db  // handle the syntax (specific to this rep here) for variable management
                                let db_ky = step_entry.substring("files::calc::".length)
                                if ( db_ky.indexOf("$") > 0 ) {  // says that there is an incrementer variable perhaps previously defined
                                    let db_ky_parts = db_ky.split("$")
                                    db_ky = db_ky_parts[0]              // expose the key into the name_drop db
                                    var_set_expr = db_ky_parts[1]       // get the variable update expressions
                                }
                                let entry_data = db[db_ky]   // the db stores operational characteristics of named skeletal parts
                                let back_ref_ky = db_ky
                                if ( typeof entry_data === "object" ) {  // In the db the key may be vanilla like the one in use
                                    sk_map[step_entry] = Object.assign({},entry_data)
                                } else {
                                    back_ref_ky = db_ky     // otherwise, it may indicate an abstraction of the range.
                                    db_ky = db_ky.substring(0,db_ky.lastIndexOf('_') + 1)
                                    entry_data = db[db_ky]
                                    sk_map[step_entry] = Object.assign({},entry_data)
                                }
                                //  add a tracker for this calculator, which may be used in other steps
                                this.add_tracking_for_calc(sk_key,step_entry)
                                //
                                entry_data = sk_map[step_entry]
                                if ( entry_data.file ) {        // delay loading the file ... the field "file" will likely refer to a '.tmplt' file.
                                    entry_data.path_finder = "html" // add this field, it is the path to a directoy in alpha-copious
                                    this.delay_file_loading_queue.push(entry_data)
                                }
                                // makes a link between the structure generation operations and incrementer operations
                                if ( this.has_incrementer(entry_data) ) {  // keep structures of incrementers for updates
                                    this.add_to_incrementers(incrementer_set,entry_data,var_set_expr)
                                }
                                // calculations taken from the DB provide delay_file_loadingoperations more complex than increment
                                if ( this.has_calc(entry_data) ) {
                                    let calls = this.gather_calculations(entry_data)   // gets parameters and op components together
                                    for ( let a_call of calls ) {  // for this skeletal step make all the calls gathered -- uses local data
                                        this.make_call(entry_data,a_call,back_ref_ky)
                                    }
                                }
                                //
                            }
                            //
                            //
                        // FILES::PARAMS - load files taking parameters 
                        // CSS::PARAMS
                        } else if ( step_entry.startsWith('files::params::') || step_entry.startsWith('css::params::') ) {
                            let loadable_entry = step_entry.replace("::params","")
                            sk_map[step_entry] = await this.entry_loading(loadable_entry)
console.log(step_entry)
console.dir(sk_map[step_entry],{ depth : 6})
                        // FILES::ELEMENTS - files operating on lists of elements
                        // CSS::ELEMENTS
                        } else if ( step_entry.startsWith('files::elements::') || step_entry.startsWith('css::elements::') ) {
                            let loadable_entry = step_entry.replace("::elements","")
                            sk_map[step_entry] = await this.entry_loading(loadable_entry)
                        // FILES
                        // CSS -- nothing special = copy and paste
                        } else {
console.log("CALLING ENTRY LOADING",step_entry)
                            sk_map[step_entry] = await this.entry_loading(step_entry)
console.log("DONE CALL --  ENTRY LOADING",step_entry)
                        }
                    // TEMPLATE 
                    } else if ( step_entry.startsWith('template::') ) {
                        // similar to verbatim in that the script won't be changed much.
                        // however, templates may be loaded recursively, resulting in a tree for future assembly
                        let data = step_entry.substring(('template::').length)
                        data = data.trim()
                        let brace_i = data.indexOf('{')
                        let brace_n = data.lastIndexOf('}')
                        data = data.substring(brace_i,brace_n-1)
                        data = parse_util.clear_comments(data)      // take out this human readable info that interferes with machine processing
                        //
                        sk_map[step_entry] = {
                            "type" : "template",
                            "data" : data
                        }
                        if ( this.check_recursive_data(data) ) {        // handle recursion  -- build tree
                            sk_map[step_entry].recursive = await this.get_files_and_vars(step_entry,data)  // subfile processing
                        }
                    // SCRIPT
                    } else if ( step_entry.startsWith('script::') ) {   // parse out the script section
                        // scripts are preprocessed for bundling 
                        // bundled scripts will be removed from the skeleton and the bundle line will be added 
                        // for each bundle created from the scripts of the current skeleton
                        // remaining scripts will be added to the template files generated from the skeleton
                        // Scripts that remain may contain variables for customization and final substitution
                        // 
                        if ( step_entry.startsWith('script::params') ) {
                            let loadable_entry = step_entry.replace("::params","")
                            sk_map[step_entry] = await this.entry_loading(loadable_entry)
console.log(step_entry)
console.dir(sk_map[step_entry],{ depth : 6})

                            // let loadable_entry = step_entry.replace("::params","")
                            // loadable_entry = loadable_entry.substring(0,loadable_entry.indexOf("{"))                
                            // //
                            // let script_spec = await this.entry_loading(loadable_entry)   // load the script (it may be output in the template)
                            // let params = step_entry.substring(step_entry.indexOf("{")).trim()
                            // script_spec.evaluations = this.evaluation_map(params)
                            // //
                            // this.early_evaluations(script_spec)
                            // //
                            // console.log("SCRIPT WITH PARAMETERS:: ",step_entry)
                            // console.dir(script_spec)
                            // sk_map[step_entry] = script_spec
                        } else {
                            let script_spec =  await this.entry_loading(step_entry)   // load the script (it may be output in the template)
                            let data_form = script_spec.data
                            if ( (typeof script_spec.kernel !== "undefined") ) {
console.log("FIX UP KERNEL",script_spec.kernel,sk_key)
                            //     let sk_c = Object.assign({},this.skel_to_concerns[sk_key].concerns)
                            //     for ( let [crn,usages] of Object.entries(sk_c) ) {
                            //         let dr = usages.dir
                            //         dr = dr.replace('@kernel',script_spec.kernel)
                            //         dr = this.paths.compile_one_path(dr)
                            //         usages.dir = dr
                            //         let dir_key = '@{[targets.dir]}'
                            //         let dat = data_form.replace(dir_key,dr)
                            //         if ( dat === data_form ) {
                            //             dir_key = `@{[targets.dir]/${script_spec.use_case}}`
                            //             dat = data_form.replace(dir_key,dr)
                            //         }
                            //         usages.data = dat
                            //     }

                            //     script_spec.customizations = sk_c
                            //     //
                            }
                            sk_map[step_entry] = script_spec
                        }
                        //
                    } else {
console.log("NOT HANDLED YET: ",step_entry)
                        sk_map[step_entry] = ""
                    }
                }
            }
        }
    }


    /**
     * 
     * @param {*} skeleton_src 
     */
    async leaf_html_directives(skeleton_src) {   // map: file name -> structured skeleton information
        //
        //
// console.log("leaf_html_directives ------------------------------------------------------------------->> ")
// console.dir(skeleton_src,{ depth: 6})
        //
        this.shared_entries = {}
        // `skeleton_src` -- previously loaded `sk_key` is the file name, `skel_def` is the file contents (structured)
        // adding an `sk_map` to each `sk_def` 
        for ( let [sk_key, op_map ] of Object.entries(skeleton_src) ) {
            for ( let [op, skel_def ] of Object.entries(op_map) ) {
                let sk_map = {}
                let incrementer_set = {}  // keep track of the variables used to increment repeated sections
                let skeleton = skel_def.skeleton
                await this.build_entry_parsing(sk_key,skeleton,skeleton_src,sk_map,incrementer_set)
                skel_def.skeleton_map = sk_map
                skel_def.incrementer_set = incrementer_set
            }
        }
    }



    /**
     * Called after other processing during the preparation phase, but before writing out the results of preparation.
     * 
     * There is a queue, `delay_file_loading_queue`, that hold structures with empty data components and with file names. 
     * The elements of the queue were processed during synchronous analysis of text and time was not alloted to 
     * loading the data. 
     * 
     * `delay_file_loading_queue` receives elements from `seek_imports` and from parsing `files::calc` sections,
     * which refer to the name_drop.dbs.
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



    /**
     * Support (helper) for evaluating the delayed queue.
     * (see delayed queue documentation)
     * 
     * Handles simple subsitutions that can be done with reducing forms.
     * 
     * @param {object} entry_data 
     * @returns {boolean}
     */
    conditionless_evaluations_substitution(entry_data) {
        let data = entry_data.data

//console.log("conditionless_evaluations_substitution", data)

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
     * Goes through the delayed file queue looking for evaluations that
     * can be substituted into the data.
     * 
     * Makes a backup copy of the substitution form. The backup will be made if there are previously
     * analyzed recursions or if there are reductions.
     * 
     * If there are evaluations, the `conditionless_evaluations_substitution` will be applied.
     * 
     * @param {object} name_to_data 
     */
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
     * Given a list of conditions and variable evaluations, 
     * this method selects a branch of the condition's
     * antecedant to be used as the substitution for the condition's test variable
     * in the data of the containing element.
     * 
     * @param {Array} conds 
     * @param {object} params 
     * @returns {Array}
     */
    conds_reduction(conds,params) {
        //
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
                if ( cond.positive_exec.file && cond.positive_exec.file[0].data ) {
                    replacer = cond.positive_exec.file[0].data
                }
            } else {
                replacer = cond.negative_exec.neg
                replacer = parse_util.subst(replacer,vform,val)
                if ( cond.negative_exec.file && cond.negative_exec.file[0].data ) {
                    replacer = cond.negative_exec.file[0].data
                }
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
    list_map_to_substs(data,subst_list,index_var) {
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
     * @param {string} val 
     */
    value_is_custom_type(val) {
        if ( val === '%config%' ) {
            return true
        }
        return false
    }

    /**
     * 
     * @param {string} var_form 
     * @param {string} val 
     * @returns {string}
     */
    value_from_custom_source(var_form,val) {
        if ( this.global_variable_values ) {
            if ( val === '%config%' ) {
                let global_conf_map = this.global_variable_values.var_to_value
                let vky = var_form.replace(val,"").replace("@{","").replace("}","")
                val = global_conf_map[vky]
                return val
            }
        }
        return "TESTVAL"
    }


    /**
     * map_to_substs
     * 
     * @param {string} data 
     * @param {Array} subst_list 
     */
    map_to_substs(data,subst_list) {
        //
        for ( let asubst of subst_list ) {
            //
            let params = asubst.params_def
            let conds = asubst.conds
            //
            let changed_data = "" + data
            //
            for ( let acond of conds ) {
                changed_data = parse_util.subst(changed_data,acond.replace,acond.replacer)
            }
            for ( let param in params ) {
                let var_form = `@{${param}}`
                let val = params[param]
                if ( this.value_is_custom_type(val) ) {
                    val = this.value_from_custom_source(var_form,val)
                }
                changed_data = parse_util.subst(changed_data,var_form,val)
            }
            //
            if ( parse_util.has_parameter_block(changed_data) ) {
                changed_data = parse_util.remove_parameter_block(changed_data)
            }
            //
            asubst.data = changed_data        
        }
        //
    }


    /**
     * 
     * @param {string} entry_ky 
     * @param {object} param_descr 
     */
    go_deep(entry_ky,param_descr) {
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
            // console.log("go_deep",entry_ky)
            // console.dir(param_descr)

                        this.go_deep(entry_ky,pdescr)
                    }
                    if ( pdescr.recursive ) {
                        this.executable_condition_processing(pdescr)
                        this.tree_conditional_reduction(pdescr)
                        pdescr.data = this.join_executables(pdescr)
                    }
                }
            }
        }
    }


    /**
     * 
     * @param {object} pdescr 
     * @returns {string}
     */
    join_executables(pdescr) {
        let reductions = pdescr.subst_recursive
        if ( reductions && Array.isArray(reductions) ) {
            let data_only = reductions.map((red) => {
                let next_data = red.data
                if ( !next_data || (typeof next_data !== 'string')) return ""
                else return next_data.trim()
            })
            return data_only.join("\n")
        }
        return ""
    }


    /**
     * 
     * @param {object} transformed 
     */
    conditional_evaluations(transformed) {
        for ( let [sk_name, op_map ] of Object.entries(transformed) ) {
            for ( let [op, skel ] of Object.entries(op_map) ) {
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
                            if ( entry?.subst_recursive && entry?.conds ) {
                                for ( let evalr of entry.subst_recursive ) {
                                    let params = evalr.params_def
                                    evalr.conds = this.conds_reduction(entry.conds,params)
                                }
                                let data = entry.data
                                entry.backup_data = "" + data
                                this.list_map_to_substs(data,entry.subst_recursive,entry.recursive.params_def._var_name)
                            } else {
                                continue
                            }
                        }
                        if ( parameter_key ) {
                            let pars = parameter_key.replace("_params<","").replace(">","").split(",")
                            for ( let par of pars ) {
                                let pdescr = desciptor[par]
                                if ( typeof pdescr.tree === "object" ) {
                                    this.go_deep(entry_ky,pdescr)
                                }
                                if ( pdescr.recursive ) {
                                    this.executable_condition_processing(pdescr)
                                    this.tree_conditional_reduction(pdescr)
                                    pdescr.data = this.join_executables(pdescr)
                                }
                            }
                        }
                    }
                }
            }
        }
    }



    /**
     * 
     * @param {string} data 
     * @returns 
     */
    has_import_def(data) {
        let match_def = this.import_entry_match.exec(data)
        if ( match_def ) {
            return match_def[1]
        }
        return false
    }

    /**
     * 
     * @param {object} transformed 
     */
    lift_remaining_imports(transformed) {
        for ( let [sk_name, op_map ] of Object.entries(transformed) ) {
            for ( let [op, skel ] of Object.entries(op_map) ) {
                let sk_map = skel.skeleton_map
                if ( typeof sk_map !== "object" ) continue
                for ( let [step_entry,entry] of Object.entries(sk_map) ) {
                    let data = entry?.data
                    if ( typeof data === "string" ) {
                        let import_type = this.has_import_def(data)
                        if ( typeof import_type === "string" ) {
                            //
                            if ( entry.recursive && entry.recursive.executables && entry.recursive.executables.imports ) {
                                let imps = entry.recursive.executables.imports
                                for ( let imp of imps ) {
                                    let repl = imp.replace
                                    let value = imp.data            // should already be loaded
                                    //
                                    data = parse_util.subst(data,repl,value)
                                    //
                                }
                                entry.data = data
                            }
                            //
                        }
                    } else {
                        if ( entry === undefined ) {
                            console.log("lift_remaining_imports",sk_name,step_entry)
                        }
                    }
                }
            }
        }
        //
    }


    /**
     * 
     * @param {*} entry 
     * @param {*} data 
     * @returns 
     */
    entry_is_list(entry,data) {
        if ( entry.recursive && entry.recursive._is_loop ) {
            return true
        }
        let found_loop = data.startsWith("@list<")
        return found_loop
    }

    /**
     * 
     * @param {*} data 
     * @param {*} ref 
     * @returns 
     */
    remove_loop_header(data,ref) {
        let stop_marker = `<@${ref}>`
        let stop_point = data.indexOf(stop_marker)
        if ( stop_point > 0 ) {
            let update_data = data.substring(stop_point + stop_marker.length)
            let end_marker = `</@${ref}>`
            update_data = update_data.replace(end_marker,"")
            return update_data
        }

        return data
    }

    /**
     * 
     * @param {object} transformed 
     */
    loop_finalization(transformed) {
        for ( let [sk_name, op_map ] of Object.entries(transformed) ) {
            for ( let [op, skel ] of Object.entries(op_map) ) {
                let sk_map = skel.skeleton_map
                if ( typeof sk_map !== "object" ) continue
                for ( let [step_entry,entry] of Object.entries(sk_map) ) {
                    let data = entry.data
                    if ( typeof data === "string" ) {
                        if ( this.entry_is_list(entry,data) && skel.parameterized ) {
                            //
                            let skel_loop_vars = skel.parameterized[step_entry]
                            let itr_name = entry.recursive.params_def._var_name
                            let ref = skel_loop_vars[itr_name]
                            if ( ref === "list" ) {
                                let list_ky = `_type<${itr_name}>`
                                let loop_list = skel_loop_vars[list_ky]
                                let dat_tmplt = this.remove_loop_header(data,itr_name)
                                let total_data = ""
                                for ( let el of loop_list ) {
                                    let el_data = "" + dat_tmplt
                                    for ( let ky in el ) {
                                        let value = el[ky]
                                        let finder = entry.recursive.params_def[ky]
                                        el_data = parse_util.subst(el_data,finder,value)
                                    }
                                    total_data += el_data
                                }
                                entry.data = total_data
                            }
                            //
                        }
                    }
                }
            }
        }
        //
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


    /**
     * 
     * @param {object} entry 
     */
    executable_condition_processing(entry) {
        let par_src = entry.recursive.params_def
        entry.subst_recursive = []
        // 
        let subst_vals = Object.assign({},par_src)
        //
        entry.subst_recursive.push({ "params_def" : subst_vals })
        entry.conds = this.find_conditionals(entry.recursive.executables.execs)
    }



    /**
     * 
     * @param {object} entry 
     */
    tree_conditional_reduction(entry) {
        if ( entry.subst_recursive && entry.conds ) {
            for ( let evalr of entry.subst_recursive ) {
                let params = evalr.params_def
                evalr.conds = this.conds_reduction(entry.conds,params)
            }
            let data = entry.data
            entry.backup_data = "" + data
            this.map_to_substs(data,entry.subst_recursive)
        }
    }


    /**
     * 
     * @param {string} ptype 
     */
    is_tree_type(ptype) {
        if ( ptype[0] === '%' ) {
            if ( ptype === "%file%" ) {
                return true
            }
        }
        return false
    }


    /**
     * 
     * @param {object} skel 
     * @param {string} entry_ky 
     * @param {string} pname 
     * @returns {string}
     */
    data_from_parameter(skel,entry_ky,pname) {
        let p_entry = skel.parameterized[entry_ky]
        let will_return_data = ""
        if ( p_entry ) {
            let p_def = p_entry[pname]
            let data = p_def.data
            if ( typeof data === "string" ) {
                if ( p_def.tree ) {
                    let rec = p_def.recursive
                    if ( rec ) {
                        let dst_pars = rec.params_def
                        if ( dst_pars ) {
                            for ( let par in dst_pars ) {
                                if ( !(p_def.tree[par].tree) && (p_def.tree[par].recursive === undefined) ) {
                                    dst_pars[par] = p_def.tree[par].data
                                } else {
                                    if ( typeof p_def.tree[par].recursive === "object" ) {
                                        let pdescr = p_def.tree[par]
                                        this.executable_condition_processing(pdescr)
                                        this.tree_conditional_reduction(pdescr)
                                        pdescr.data = this.join_executables(pdescr)
                                        dst_pars[par] = pdescr.data
                                    }
                                }
                            }
                        }
                        if ( rec.executables ) {
                            let pdescr = p_def
                            this.executable_condition_processing(pdescr)
                            this.tree_conditional_reduction(pdescr)
                            pdescr.data = this.join_executables(pdescr)
                        }
                        will_return_data = p_def.data
                    }
                } else {
                    will_return_data = data
                }
            }
        }
        if ( parse_util.has_parameter_block(will_return_data) ) {
            will_return_data = parse_util.remove_parameter_block(will_return_data)
        }
        return will_return_data
    }



    /**
     * 
     * @param {object} transformed 
     */
    up_prop_data_to_vars(transformed) {
        for ( let [sk_name, op_map ] of Object.entries(transformed) ) {
            for ( let [op, skel ] of Object.entries(op_map) ) {
                let sk_map = skel.skeleton_map
                if ( typeof sk_map !== "object" ) continue
                for ( let [entry_ky,desciptor] of Object.entries(sk_map) ) {
                    if ( desciptor?.recursive ) {
                        let rec = desciptor.recursive
                        desciptor.backup_data = "" + desciptor.data
                        if ( rec.params_def ) {
                            //
                            for ( let [pname,ptype] of Object.entries(rec.params_def) ) {
                                if ( this.is_tree_type(ptype) ) {
                                    let pdat = this.data_from_parameter(skel,entry_ky,pname)
                                    rec.params_def[pname] = pdat
                                }
                            }
                        }
                        if ( rec.executables ) {
                            let pdescr = desciptor
                            this.executable_condition_processing(pdescr)
                            this.tree_conditional_reduction(pdescr)
                            let ddat = this.join_executables(pdescr)
                            if ( parse_util.has_parameter_block(ddat) ) {
                                ddat = parse_util.remove_parameter_block(ddat)
                            }
                            desciptor.data = ddat
                        }
                    } else {
                        if ( desciptor === undefined ) {
                            console.log("up_prop_data_to_vars",sk_name,entry_ky)
                        }
                    }
                }
            }
        }
    }



    /**
     * 
     * @param {object} transformed 
     */
    list_to_skeletal_variable_assignment(transformed) {
        for ( let [sk_key, op_map ] of Object.entries(transformed) ) {
            for ( let [op, skel ] of Object.entries(op_map) ) {
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
                            if ( entry?.recursive ) {
    //console.log("list_to_skeletal_variable_assignment",entry.recursive.params_def)
                            } else {
                                continue
                            }
                            let el_var = list_key.replace("_type<","").replace(">","").trim()
                            if ( desciptor[el_var] === "list" ) {
                                let alist = desciptor[list_key]
                                if ( Array.isArray(alist) ) {
                                    let par_src = entry.recursive.params_def
                                    entry.subst_recursive = []
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
    }



    /**
     * 
     * @param {object} transformed 
     */
    incremental_evaluations(transformed) {
        //
        for ( let [sk_key, op_map ] of Object.entries(transformed) ) {
            for ( let [op, skel ] of Object.entries(op_map) ) {
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
        }
        //
    }


    /**
     * 
     * @param {object} transformed 
     */
    finalize_markup(transformed) {
        for ( let [sk_name, op_map ] of Object.entries(transformed) ) {
            for ( let [op, skel ] of Object.entries(op_map) ) {
                let sk_map = skel.skeleton_map
                if ( typeof sk_map !== "object" ) continue
                let fdata = ""
                for ( let [entry_ky,desciptor] of Object.entries(sk_map) ) {
                    if ( entry_ky.indexOf("script::") >= 0 ) {
                        // the script should be loaded
                        fdata += (desciptor.data ? desciptor.data : "") + "\n"
                        fdata = parse_util.clear_block_comments(fdata)
                    } else {
                        if ( typeof desciptor === "string" ) {
                            fdata += desciptor
                        } else if ( typeof desciptor === "object" ) {
                            fdata += desciptor.data ? desciptor.data : ""
                        }
                    }
                }

                skel.final.markup = fdata
            }
        }
    }


    /**
     * 
     * for the call tosection_parsing(all_skeletons)
     * The one parameter `all_skeletons` is a map from file names to skeleton ascii.
     * 
     * This method parses the skeleton ascii, managing the document structure, 
     * creating lists of leaf files specified in the text and extracting skeleton files
     * in order to add them to the map `all_skeletons`.
     * 
     * Skeletons are parsed into sections. HTML structure is permitted in a skeleton.
     * Variables are allowed as $$<variable name> forms, where <variable name> is an identifier.
     * 
     * Parsing includes restructuring files based on configuration variables. 
     * Each concern may have different requirments (formulaic variations on layout, including number of sections, 
     * grid mapping, topic structure, etc.)
     * 
     * @param {object} all_skeletons
     * @param {object} skel_to_concerns -- each skeleton serves a set of concerns 
     */
    async skeleton_parsing(all_skeletons) {
        // expand and parse all skeletons being parsed in the batch
        let transform_1 = await this.section_parsing(all_skeletons)
        //
//         // This script parsing may be obsolete after a short stay here.
//         // preprocessing the skeletons has worked better.
//         // this may still be good for shared scripts that may be better embedded. But, some handling of multiple uses may help 
//      let script_stats = this.coalesce_scripts(transform_1)   // keeping track of scripts that are parsed and may be requested by any number of skeletons
//         this.update_script_stats_usage(transform_1,script_stats)

//         let occurence_partition = this.partition(script_stats)
// console.dir(occurence_partition)
//         await this.prep_script_directories(occurence_partition)

        // 

        // Now, get ready for operating on the html inclusions specified by a skeleton.
        // Note: some loops will have been expanded leaving behind other directive (e.g. calc)
        await this.leaf_html_directives(transform_1)

        let name_to_data = await this.delay_file_loading()

        this.evaluate_delayed_queue(name_to_data)

        this.incremental_evaluations(transform_1)

        this.list_to_skeletal_variable_assignment(transform_1)

        this.up_prop_data_to_vars(transform_1)

        this.conditional_evaluations(transform_1)

        this.lift_remaining_imports(transform_1)

        this.loop_finalization(transform_1)

        this.finalize_markup(transform_1)

        // just to keep a record of what has taken place in this method
        let str = JSON.stringify(transform_1,null,4)
        await fos.write_out_string(this.top_level_parsed,str)

        return transform_1
    }




    // ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ----

    /**
     * This method needs the outputs stored in the configuration file.
     * Each concern gets a reverse map of the ogroup skeleton map, which mapped template file names to skeleton inputs
     * 
     * @param {object} skel_matrix 
     */
    collect_concerns(outputs_field_of_conf) {
        let concerns_map = {}
        for ( let ogroup of outputs_field_of_conf ) {  // an ogroup
            let concerns = ogroup.targets.concerns          // targets ... concerns array  (peculiar to this ogroup)
            for ( let concern of concerns ) {
                let mapped_c = concerns_map[concern]  // the concern may appear in more than one ogroup, but that may not be a good idea considering ops
                if ( !mapped_c ) {
                    mapped_c = {}
                    concerns_map[concern] = mapped_c
                }
                let skeletons = ogroup.skeletons    // output file to skeleton
                let r_skeletons = parse_util.reverse_map(skeletons)
                for ( let skeleton in r_skeletons ) {  // the skeletone is a "file" name
                    if ( mapped_c[skeleton] === undefined ) mapped_c[skeleton] = {}  // not one to one
                    mapped_c[skeleton] = Object.assign(mapped_c[skeleton],r_skeletons[skeleton])  // r_skeletons[skeleton] is an object (mapping not one to one) 
                }
            }
        }

        return concerns_map
    }


    /**
     * 
     * @param {Array} concerns 
     * @param {string} dir_form 
     * @param {string} tfile 
     * @param {string} template 
     */
    async output_ogroup_template(concerns,dir_form,tfile,template) {
        let promises = []
        for ( let concern of concerns ) {
            let top_out_dir = dir_form.replace("@concern",concern)
            let t_output_path = `${top_out_dir}${tfile}`
            let t_path = this.paths.compile_one_path(t_output_path)
            promises.push(fos.write_out_string(t_path,template))
        }
        //
        await Promise.all(promises)
    }


    /**
     * 
     * @param {object} parsed_skels 
     */
    async generate_all_concerns_templates(parsed_skels) {
        //
        let outputs = this.outputs
        for ( let ogroup of outputs ) {
            for ( let [tfile,file] of Object.entries(ogroup.skeletons) ) {
                //
                let skel_compiled_path = ogroup.skels_processed[file].ablsolute_path
                let op_key = ogroup.skels_processed[file].skel_vars_key
                op_key = op_key ? op_key : "defaults"
                let skel_data = parsed_skels[skel_compiled_path][op_key]  // This is the stuff for template generation

                let template = skel_data.final.markup   // set in `final_markup`
                //
                // now make sure each concern gets the template file to be generated buy ogroup
                let targets = ogroup.targets // targets
                let dir_form = targets.dir_form
                dir_form = dir_form.replace("@target",this.created_dir)

                await this.output_ogroup_template(targets.concerns,dir_form,tfile,template)
            }
        }
        //
        let concerns = this.collect_concerns(this.outputs)
        return concerns
    }


    /**
     * These entries appear in the name_drop.db type of file for a particular page template of a particular concern.
     * 
     * So, for instance, [websites]/@concern/templates/index.tmplt will have a name_drop type of db stored with it, as such:
     * websites]/@concern/templates/index_calc.db
     * 
     * The following would be the example of an entry:
     * 
     *  `"about_box" : {
            "name": "about",
            "content": {
                "type": "@<type>",
                "file": "./about.@<type>"
            }
        }`
     * 
     *  It is expected to be updated in the following sort of way:
     * 
     *  "name" : "about",
        "content" : {
            "svg" : "",
            "file" : "./about.svg"
        }
     *
     *  The update is done prior to running the second stage of roll-right. (It could be html instead of svg.)
     * 
     * @param {string} concern 
     * @param {object} track_map 
     */
    update_calc_tracking(concern,track_map) {
        for ( let tk in track_map ) {
            let namer = tk.replace("Box","").replace("_box","")
            track_map[tk] = {
                "name" : namer,
                "content" : {
                    "type" : "@<type>",
                    "file" : `./${namer}.@<type>`
                }
            }
        }

        track_map["_track_control"] = {
            "concern" : concern,
            "edited" : false,
            "mod-date" : Date.now(),
            "create-date" : Date.now()
        }
    }
    

    /**
     * If a user has already created a `_calc.db` file,
     * this method will inform the caller if that is the case and also 
     * if the `_track_control` structure has an `edited` field set to true.
     * 
     * As such, this affects the user's work process. A user wishing to keep edits must 
     * set the `edited` field to true. Otherwise, the file may be overwritten, which is usually
     * not desirable, except occasionally. As such, the user should be able to toggle this field 
     * in any application that manages this sort of file.
     * 
     * @param {string} calc_tracking_file -- a path to a concerns calc DB file. 
     * @returns {boolean}
     */
    async existing_calc_track(calc_tracking_file) {
        let tracker = await fos.load_json_data_at_path(calc_tracking_file)
        if ( tracker ) {
            if ( tracker._track_control.edited ) {
                return tracker
            }
        }
        return false
    }
    

    /**
     * This method takes an existing tracking file contents for a `_calc.db` region
     * and includes it in, and overwrites, the generic `_calc.db` found in the alpha directories
     * provided the user (admin).
     * 
     * @param {object} new_tracking 
     * @param {object} saved_track_map 
     * @returns {boolean}
     */
    update_tracker_with_new(new_tracking,saved_track_map) {
        for ( let tky in new_tracking ) {
            if ( saved_track_map[tky] ) continue
            saved_track_map[tky] = new_tracking[tky]
        }
        return saved_track_map
    }


    /**
     * For reentry after compilation.
     * Load the ogroups file which should have the template files already processed 
     * ahead of applying updates to the sectional database.
     */
    async load_ogroups_intermediate_files() {
        //
        let ogroups_file = `[websites]/${this.project_dir}/ogroups_intermediate_files.json`
        ogroups_file = this.paths.compile_one_path(ogroups_file)
        this.outputs = await fos.load_json_data_at_path(ogroups_file)
        //
// console.dir(this.outputs,{ depth : 6 })
    }

    /**
     * 
     * makes sure that directories receiving the generated assets exists 
     * and are structure according to the configuration.
     * 
     * Writes out template files each with a '.tmplt' suffix.
     * Writes out a manifest to these files, concerns_to_files.json. 
     * 
     * Writes out db files for calculated regions. Outputs a file for each template. 
     * The DB files can be used later to override the generic database stored in the alpha.
     * 
     * Creates one top level file to keep track of the individual, template associated, files.
     * That is `concerns_named.db`
     * 
     * All of the individual template and DB files can be output to the 'template' directories of the concerns.
     * The top level file can be output to the directory commanding all concerns, typically "template-configs"
     * in `[websites]` directory.
     * 
     * @param {object} concerns_to_files 
     */
    
    async write_templates_op_data() {
        //
        let concerns_to_files = this.collect_concerns(this.outputs)
        //
        let concerns_file = `[websites]/${this.project_dir}/concerns_to_files.json`
        concerns_file = this.paths.compile_one_path(concerns_file)
        await fos.write_out_pretty_json(concerns_file,concerns_to_files,4)
        //
        let ogroups_file = concerns_file.replace("concerns_to_files.json","ogroups_intermediate_files.json")
        ogroups_file = this.paths.compile_one_path(ogroups_file)
        await fos.write_out_pretty_json(ogroups_file,this.outputs,8)
        //
        // get the name of the type level file 
        let db_locations = concerns_file.replace("concerns_to_files.json","concerns_named.db")
        let concerns_db_files = {}
        parse_util.copy_keys(concerns_db_files,concerns_to_files,"object")
        //
        //
        let outputs = this.outputs
        for ( let ogroup of outputs ) {
            let targets = ogroup.targets // targets
            let dir_form = targets.dir_form
            //
            dir_form = dir_form.replace("@target",this.created_dir)
            for ( let concern of targets.concerns ) {
                //
                let db_output = concerns_db_files[concern]
                //
                let top_out_dir = dir_form.replace("@concern",concern)
                //
                let sk_maps = concerns_to_files[concern]
                let promises = []
// console.log(">> >> >>")
// console.log(concern)
// console.dir(Object.keys(sk_maps))
                for ( let sk in sk_maps ) {
                    let opairs = sk_maps[sk]
                    for ( let tfile in opairs ) {
                        //
                        let t_output_path = `${top_out_dir}${tfile}`
                        let t_path = this.paths.compile_one_path(t_output_path)
                        //
// console.log("write_templates",dir_form,">>",t_path)     // outputs the template here.
//                         promises.push(fos.write_out_string(t_path,template))
                        //
                        if ( this.tracking_skel_calc_usage[sk] ) {
                            let track_map = this.tracking_skel_calc_usage[sk]
                            let calc_tracking_file = t_path
                            this.update_calc_tracking(concern,track_map)
                            calc_tracking_file = calc_tracking_file.replace('.tmplt',`_calc.db`)
                            let tracker = false
                            // Checks to see if there are custom definitions set by the user.
                            if ( tracker = await this.existing_calc_track(calc_tracking_file) ) {
                                // Given there are such definition, use them.
                                track_map = this.update_tracker_with_new(track_map,tracker)
                            }
                            // output the cacluation sections DB for each top level file.
                            promises.push(fos.write_out_pretty_json(calc_tracking_file,track_map,4))
                            db_output[calc_tracking_file] = 1  // add to the high level manifest pointing to these files
                        }
                   }    
                }
                //
                await Promise.all(promises)
            }
        }
        //
        // output the top level file used to find the DBs 
        // this is a map of concerns to db files
        if ( Object.keys(this.tracking_skel_calc_usage).length ) {
            await fos.write_out_pretty_json(db_locations,concerns_db_files,4)
        }
        //
        return concerns_to_files
    }



    /**
     * 
     * @param {object} el_var_map - var name and types
     * @param {object} el        - var name and values
     * @param {string} target_data 
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
     * This is supposed to be the starting point for calling variable instantiation
     * on the blocks at the skeleton level. The level_1_parameterized_file parameter 
     * should be the expansion that is the value keyed by the file name in the skeleton map.
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
        // load relevant files (identified by the configuration)  // skel_to_concerns is also global member
        let all_skeletons = await this.load_skeletons()  // get the files and create `skel_to_concerns` map
        await this.load_name_drops_db() // loads this db only
        //
        // skel_to_concerns is added because each concern will have different structural demands
        // where page structure can be derived from cannonical descriptions (later maybe AI normalization)
        let parsed_skels = await this.skeleton_parsing(all_skeletons)  // injest structure of all skeletons in this map
        await this.name_parameters_output() // after parsing deal with the database entries for each skeleton and make 
                                            // a version of the DB which may be customized before taking the next step (phase 2)

        return parsed_skels
    }


}



module.exports = SkelToTemplate