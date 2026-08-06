

const fos = require('extra-file-class')()
let ParseUtils = require('../lib/utils')
let parse_util = new ParseUtils()


const SkelToTemplate = require('../lib/SkelToTemplate')

/**
 * @class TemplatesToPreStaging
 * 
 * This class extends SkelToTemplate with operations specific to phase 2.
 * 
 * This is mostly about creating substitution files and merging them with existing susbt files.
 * 
 * Also, the .db files, which are used to make subst file entries, are loaded from specialized 
 * templates for the concerns.
 * 
 * This phase will generate (** may regenerate) templates after taking into consideration the customization of the db.
 * The db in question is the db generated from entries in the name_drop.db. These db's are called `_calc.db` files 
 * since they are made for files::calc entries in the skeleton.
 * 
 * A file such as index_calc.db will have entries that are merged into the subst file for the website.
 * This entries are called out in template sections where `.content` will replace a non-escaped 
 * substitution form (as per handle bars)
 * 
 */
class TemplatesToPreStaging extends SkelToTemplate {

    /**
     * 
     * @param {object} conf 
     */
    constructor(conf) {
        super(conf)
        this.concern_to_odir = {}
        let outputs = conf.outputs
        if ( outputs && Array.isArray(outputs) ) {
            outputs = JSON.parse(JSON.stringify(outputs))
            for ( let ogroup of outputs ) {
                let dir_form = ogroup.targets.dir_form
                for ( let concern of ogroup.targets.concerns ) {
                    this.concern_to_odir[concern] = dir_form.replace("@concern",concern)
                }
            }
        }
    }



    handle_outer_loop(var_starts,i,a_var,found_vars) {
        let loop_vars = {}
console.log(a_var)
        let loop_lines = [ a_var ]; i++
        a_var = a_var.replace("#each",'').trim()
        let instead_of_list = false
        if ( a_var.indexOf('.') > 0 ) {
            let vparts = a_var.split('.')
            a_var = vparts[0].trim()
            let list_spec = vparts[1].trim()
            if ( list_spec !== "list" ) {
                instead_of_list = list_spec
            }
        }
        //
        let control_var = a_var
        loop_vars[a_var] = {
            "list" : [],
            "fields" : {}
        }
        if ( instead_of_list ) {
            loop_vars[a_var][instead_of_list] = []
            delete loop_vars[a_var].list
            loop_vars[a_var].fields["_type<array>"] = instead_of_list
        } else {
            loop_vars[a_var].fields["_type<array>"] = "list"
        }
        //
        let depth = 1
        while ( depth > 0 ) {
            let l_dstart = var_starts[i++]
            loop_lines.push(l_dstart)
            let add_brace = l_dstart[0] === "{" ? 1 : 0
            let a_var = l_dstart.substring(0,l_dstart.indexOf("}}") + add_brace)
            if ( a_var.startsWith('#each') ) { depth++ }
            else if ( a_var.startsWith('/each') ) { depth-- }
            else {
                if ( a_var.indexOf('.' ) > 0 ) {
                    if ( a_var[0] === '{' ) {
                        a_var = a_var.substring(1,a_var.lastIndexOf('}'))
                    }
                    let var_parts = a_var.split('.')
                    let part_tree = {}
                    let content_indicator = var_parts.shift()
                    if ( content_indicator.indexOf('++') > 0 ) {
                        let loop_indicator = content_indicator.substring(content_indicator.indexOf('@<') + 2,content_indicator.indexOf('>'))
                        loop_vars[control_var]["$_looping"] = loop_indicator
                    }
                    loop_vars[control_var].fields[content_indicator] = part_tree
                    let last_part = var_parts.pop()
                    if ( last_part ) {
                        for ( let part of var_parts ) {
                            part_tree[part] = {}
                            part_tree = part_tree[part]
                        }
                        part_tree[last_part] = ""
                    }
                } else {
                    loop_vars[control_var].fields[a_var] = ""
                    if ( a_var.indexOf('++') > 0 ) {
                         loop_vars[control_var]["$_looping"] = a_var
                    }
                }
            }
        }
        loop_vars[control_var]["$_data_source"] = ""
        found_vars[control_var] = loop_vars[control_var]
        return i
    }



    /**
     * Goes through the entire text of a fully generated template and finds variables
     * that will be part of a substitution form. Makes a table of these variables
     * and returns it.
     * 
     * Initially, all variable names map to an empty string. Later either old values will be assigned to the variables
     * or a user may add new values.
     * 
     * @param {string} data 
     * @returns {object}
     */
    find_substitutions_vars(data) {
        let found_vars = {}
        let data_update = false
        let var_starts = data.split("{{")
        var_starts.shift()
        let unloaded_files = []
        let n = var_starts.length
        for ( let i = 0; i < n; i++ ) {
            let dstart = var_starts[i]
            let add_brace = dstart[0] === "{" ? 1 : 0
            let a_var = dstart.substring(0,dstart.indexOf("}}") + add_brace)
            //
            if ( a_var[0] === '#' ){
                if ( a_var.startsWith('#each') ) {
                    i = this.handle_outer_loop(var_starts,i,a_var,found_vars)
                    continue
                }
            }
            //
            a_var = parse_util.remove_white(a_var)
            if ( a_var.indexOf('\"') > 0 ) {
                let value = a_var.replace('{\"','').replace('\"}','')
                unloaded_files.push(value)
                found_vars["__unloaded_files"] = unloaded_files
            } else {
                found_vars[a_var] = ""
            }
        }
        return [found_vars,data_update]
    }


    /**
     * 
     * Loads the top level file concerns named DB, mapping concerns to DB files associated with each template.
     * 
     * This method continues on to load all the DB file mentioned in the `concerns_named.db` file.
     * 
     * The DB files are the name_drop.db's for each file. e.g. [websites]/@target/@concern/templates/index_calc.db
     * 
     * The file `concerns_named.db` is often in `[websites]/templates-configs/` depending on the user configuration.
     *
     */
    async load_concerns_namer_dbs() {
        //
        let db_locations = `[websites]/${this.project_dir}/concerns_named.db`
        db_locations = this.paths.compile_one_path(db_locations)
        //
        let all_concerns_db = await fos.load_json_data_at_path(db_locations)

        for ( let files of Object.values(all_concerns_db) ) {
            for ( let file in files ) {
                files[file] = await fos.load_json_data_at_path(file)
            }
        }
        this.all_concerns_namer_db = all_concerns_db
    }


    /**
     * Phase 2 operation...
     * 
     * Analyze data (files) top find variables. 
     * 
     * Create variable to value objects associated with the files that a concern will 
     * require. Make sure the directories that will hold the subst file will exists 
     * before the files are created in an ensuing method call.
     * 
     * The following applies to the entries of the map that is returned:
     * 
        // Prepares an entry for each file in a subdirectory of the concern.
        // A set of variables found in the file will be identified and listed in 
        // the *variables* field. The output file is the file to be found in staging.
        // The source directory will likely be the *static* directory which will hold
        // assets used in the site/app pages of the concern. The subst file, containing
        // values and substitution maps for the file to be output will be named here as 
        // the 'subst' file. 

     * 
     * @param {object} concerns 
     * @returns {object}
     */
    async prepare_files_and_substitutions(concerns) {
        let all_c_vars = {}
        await this.load_concerns_namer_dbs()
        //
        for ( let concern in concerns ) {
            let concerns_dir = `[websites]/${concern}/`
            concerns_dir = this.concern_to_odir[concern]
            concerns_dir = this.paths.dirname(concerns_dir)
            concerns_dir = this.paths.compile_one_path(concerns_dir)
            let targeted_files = Object.values(concerns[concern])
            let concerns_vars = {}
            let concerns_files = {}
            for ( let pair of targeted_files ) {
                let keys = Object.keys(pair)
                //
                for ( let ky of keys ) {
                    //
                    let afile = `${concerns_dir}/${this.created_dir}${ky}`
                    //
                    let data = pair[ky]
                    if ( (typeof data === "undefined") || (data.length === 0) ) {
                        data = await fos.load_data_at_path(afile)
                    }
                    let [data_vars,data_update] = this.find_substitutions_vars(data)
                    if ( data_update ) {
                        pair[ky] = data_update
                    }
                    //
                    // keep adding to the concerns vars, gathering from all the files.
                    concerns_vars = Object.assign(concerns_vars,data_vars)
                    //
                    let subst_src = `${concerns_dir}/static`
//
                    let subst_file = `${subst_src}/${concern}.subst`
                    let ofile = `${concerns_dir}/pre-staging/${ky}`
                    ofile = ofile.replace(".tmplt",".html")
                    //
                    // Prepares an entry for each file in a subdirectory of the concern.
                    // A set of variables found in the file will be identified and listed in 
                    // the *variables* field. The output file is the file to be found in staging.
                    // The source directory will likely be the *static* directory which will hold
                    // assets used in the site/app pages of the concern. The subst file, containing
                    // values and substitution maps for the file to be output will be named here as 
                    // the 'subst' file. 
                    // 
                    concerns_files[ky] = {
                        "subst" : subst_file,
                        "output" : ofile,
                        "source_dir" : subst_src,
                        "variables" : data_vars
                    }
                    //
                    await fos.ensure_directories(afile,false,true)
                    await fos.ensure_directories(subst_file,false,true)
                    await fos.ensure_directories(subst_src)
                    //
                    // load the namer db's generated for each file during phase 1.
                    // It is expected by this time.
                }
            }
            // this is the high level directive for substitution on the file.
            // Each concern will map the individual files and will track all the
            // subsitution variables required by the site.
            all_c_vars[concern] = {
                "variables" : concerns_vars,
                "files" : concerns_files
            }
        }
        return all_c_vars
    }


    /**
     * 
     * @param {Array} skel_list 
     * @returns 
     */
    get_skel_css_link_files(skel_list,parsed_skels) {
        //
        let css_set = {}
        for ( let skel of skel_list ) {
            let skeleton = parsed_skels[skel]?.skeleton
            if ( skeleton && Array.isArray(skeleton) ) {
                for ( let line of skeleton ) {
                    //
                    if ( line.startsWith("link<css>::") ) {
                        let css_file = line.substring("link<css>::".length)
                        css_file = css_file.replace('<<','').trim()
                        let p = css_set[css_file]
                        css_set[css_file] = p ? p + 1 : 1
                    }
                    //
                }
            }
        }
        //
        let css_list = Object.keys(css_set)
        return css_list
    }

    /**
     * 
     * @param {string} concern 
     * @param {Array} selected_css 
     */
    async publish_css_to_concern_pre_staging(concern,selected_css) {
        let concern_css_ps_dir = '[websites]/${concern}/pre-staging/css'
        let css_src_dir = '[alpha_copious]/css'
        concern_css_ps_dir = this.paths.compile_one_path(concern_css_ps_dir)
        css_src_dir = this.paths.compile_one_path(css_src_dir)
        for ( let css of selected_css ) {
            let css_src_file = `${css_src_dir}/${css}`
            let css_dst_file = `${concern_css_ps_dir}/${css}`
            try {
                await this.fos.copyFile(css_src_file,css_dst_file)
            } catch (e) {
                console.log("did not copy",css_src_file)
            }
        }
    }

    /**
     * 
     * @param {object} concerns 
     */
    async selective_css_publication(concerns,parsed_skels) {
        //
        for ( let concern in concerns ) {
            let c_skelmap = concerns[concern]
            let skel_list = Object.keys(c_skelmap)
            let selected_css = this.get_skel_css_link_files(skel_list,parsed_skels)
            await this.publish_css_to_concern_pre_staging(concern,selected_css)
        }
    }


    /**
     * 
     * Given all the variables found in a file, for a concern,
     * this method creates JSON structured files (`.subst`)
     * A subst file is created for each file that a concern needs
     * for basic static pages and framework pages.
     * 
     * `_calc.db` data entries will appear the subst files and include information about where 
     * content is stored in files. (usually under the /static directory)
     * 
     * Called by `publish_subs_defs`. 
     * 
     * 
     * @param {string} concern 
     * @param {object} var_set 
     * @returns {object}
     */
    get_subst_vars(concern,var_set,var_src_file) {
        let subst_obj = {}
        for ( let avar in var_set ) {
            if ( (avar[0] === '{') || (avar.indexOf(".") > 0) ) {
                let base_var_name = (avar[0] === '{') ? avar.replace('{','').replace('}','') : avar
                //
                let subkeys = false
                if ( avar.indexOf(".") > 0 ) {
                    let vpars = base_var_name.split('.')
                    base_var_name = vpars.shift()
                    subkeys = vpars
                    //
                    if ( subst_obj[base_var_name] === undefined ) {
                        subst_obj[base_var_name] = {}
                    }
                }
                //
                let rec = subst_obj[base_var_name]
                if ( (typeof rec === "object") && subkeys.length ) {
                    let namer = ""
                    let actor = ""
                    let file = base_var_name
                    while ( subkeys.length ) {
                        let ky = subkeys.shift()
                        let maybe_rec = rec[ky]
                        namer = actor
                        actor = file 
                        file = ky
                        if ( maybe_rec === undefined ) {
                            maybe_rec = ""
                            if ( subkeys.length ) {
                                maybe_rec = {}
                            }
                        }
                        rec[ky] = maybe_rec
                        rec = maybe_rec
                    }
                    //
                    if ( namer.length && actor.length && file.length ) {
                        try {
                            rec = subst_obj[namer][actor]
                            //
                            rec.name = namer
                            if ( namer.indexOf(actor) > 0 ){
                                actor = ""
                            }
                            actor = parse_util.capitalize(actor)
                            rec.file = `${namer}${actor}.txt`
                        } catch(e) {}
                        //
                    } else if ( this.namer_in_name_db(concern,base_var_name,var_src_file) ) {
                        let [found_name,ftype] = this.lookup_app_assignement(concern,base_var_name,var_src_file)
                        subst_obj[base_var_name] = {
                            "name" : found_name
                        }
                        subst_obj[base_var_name][actor] = {
                            "file" : `./${found_name}.${ftype}`
                        }
                    }
                    //
                }
            } else {
                subst_obj[avar] = var_set[avar]
            }
        }
        return subst_obj
    }



    /**
     * This method uses specific merge rules that fravor the existing data from previous website 
     * renditions.
     * 
     * @param {object} subst_obj 
     * @param {object} existing_subst 
     */
    merge_existing_subst(subst_obj,existing_subst) {
        for ( let ky in existing_subst ) {
            if ( subst_obj[ky] === undefined ) {
                subst_obj[ky] = existing_subst[ky]
            } else {
                if ( (typeof existing_subst[ky] === "object") && (typeof subst_obj[ky] === "object") ) {
                    this.merge_existing_subst(subst_obj[ky],existing_subst[ky])
                } else if ( (typeof existing_subst[ky] === "object") && (typeof subst_obj[ky] !== "object") ) {
                    subst_obj[ky] = existing_subst[ky]
                } else if ( (typeof existing_subst[ky] === "string") && (typeof subst_obj[ky] === "string") ) {
                    if ( existing_subst[ky].length > 0 ) {
                        subst_obj[ky] = existing_subst[ky]
                    }
                } else if ( (typeof existing_subst[ky] === "string") && (typeof subst_obj[ky] === "object") ) {
                    subst_obj[ky].content =  existing_subst[ky]
                }
            }
        }
    }


    /**
     * Makes all the pre-staging subsitution maps needed in order to generate 
     * website/app files to be used in production.
     * 
     * If previous subst files exists, they will be merged into the new file, and the user may edit them 
     * prior to generating the first draft html that goes into pre-staging. 
     * 
     * Each `.subst` file is placed into pre-staging.
     * 
     * EXISTING FILES CAN BE USED HERE...
     * 
     * @param {object} subst_defs 
     */
    async publish_subs_defs(subst_defs) {
        //
        let concerns_subst_map = {}  // each concern will have an entry here.
        //
        for ( let concern in subst_defs ) {
            // set up the map object for the concern
            concerns_subst_map[concern] = {}
            //
            let var_set = subst_defs[concern].variables     // get the set of variables in use
            let subst_obj = this.get_subst_vars(concern,var_set)        // makes this based on existing template and name_drop db
            //
            let concerns_dir = `[websites]/${concern}/${this.created_dir}`
            concerns_dir = this.concern_to_odir[concern]
            concerns_dir = this.paths.dirname(concerns_dir)
            concerns_dir = this.paths.compile_one_path(concerns_dir)
            let file_path = `${concerns_dir}/${concern}.subst`
            //
            let static_src = `[websites]/${concern}/static/${concern}.subst`
            static_src = this.paths.compile_one_path(static_src)
            let existing_subst = false
            if ( fos.pathExists(static_src) ) {
                existing_subst = await fos.load_json_data_at_path(static_src)
                if ( existing_subst !== false ) {
                    this.merge_existing_subst(subst_obj,existing_subst)     // does a merge from the created to existing
                }
            }
            //
            await fos.write_out_pretty_json(file_path,subst_obj,4)      // an actual subst file for populating variables across the site
            //
            // The file containing sitewide variable mappings
            // this is the top level entry if specific files don't have one.
            //
            //  This is a genneral listing (db) of all variables for all sites 
            //  and for each file in a site.
            //
            concerns_subst_map[concern][concern] = {
                "path" : file_path,
                "vars" : Object.keys(var_set)
            }
            //
            let files_output = subst_defs[concern].files
            for ( let file in files_output ) {
                let file_focus = files_output[file]
                //
                let var_set = file_focus.variables
                let subst_obj = this.get_subst_vars(concern,var_set,file)
                let file_path = file_focus.output
                file_path = file_path.replace('.html','_html.subst')
                //
                if ( existing_subst !== false ) {
                    this.merge_existing_subst(subst_obj,existing_subst)
                }
                //
                file_path = await fos.ensure_directories(file_path,'',true)
                //
                await fos.write_out_pretty_json(file_path,subst_obj,4)
                //
                concerns_subst_map[concern][file] = {
                    "path" : file_path,
                    "vars" : Object.keys(var_set)
                }
            }
        }

        // write this entire DB 
        let subst_map_file = `[websites]/${this.project_dir}/concerns_to_subst_files.json`
        subst_map_file = this.paths.compile_one_path(subst_map_file)
        await fos.write_out_pretty_json(subst_map_file,concerns_subst_map,4)
    }


    /**
     * namer is a variable found in the file.
     * namer may be in the namer db of a concern, providing 
     * a calculation or a file description that will be kept with in a subst file.
     * 
     * called by get_subst_vars
     * 
     * @param {string} namer 
     * @returns 
     */
    namer_in_name_db(concern,namer,file) {
        if ( file ) {
            let file_prober = file.replace(".tmplt","_calc.db")
            for ( let ky of Object.keys(this.all_concerns_namer_db[concern]) ) {
                if ( ky.indexOf(file_prober) > 0 ) {
                    if ( namer in this.all_concerns_namer_db[concern][ky] ) {
                        return true
                    }
                }
            }
        }
        return false
    }


    /**
     * 
     * Looks in all the calc section DBs for a given concern.
     * Within the map of files to sections DBs, this finds the first match for a file name 
     * that would hold the a DB key, **namer**. If the file and the object can be found
     * by the sequence of keys, this will return the calc section name (given by an application)
     * and a file type (given by the applications)
     * 
     * This method is used by methods generating subtitution maps to be used during phase 3.
     * 
     * @param {string} concern -- the name of a concern such as a url or a business name/token
     * @param {string} namer -- a field in the a calc section db, e.g. `about_box`
     * @returns {pair} -- returns the application selected name and file type.
     */
    lookup_app_assignement(concern,namer,file) {
        if ( file ) {
            let file_prober = file.replace(".tmplt","_calc.db")
            for ( let ky of Object.keys(this.all_concerns_namer_db[concern]) ) {
                if ( ky.indexOf(file_prober) > 0 ) {
                    if ( namer in this.all_concerns_namer_db[concern][ky] ) {
                        let defs = this.all_concerns_namer_db[concern][ky][namer]
                        return [defs.name, defs.content.type]
                    }
                }
            }
        }
        return["test","html"]
    }

}


module.exports = TemplatesToPreStaging
