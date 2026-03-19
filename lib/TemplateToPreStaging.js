

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
 * This phase may regenerate templates after taking into consideration the customization of the db.
 * 
 * 
 */
class TemplatesToPreStaging extends SkelToTemplate {

 
    /**
     * 
     * @param {object} conf 
     */
    constructor(conf) {
        super(conf)
    }


    /**
     * 
     * @param {string} data 
     * @returns {Array}
     */
    find_substitutions_vars(data) {
        let found_vars = {}

        let var_starts = data.split("{{")
        var_starts.shift()
        for ( let dstart of var_starts ) {
            let add_brace = dstart[0] === "{" ? 1 : 0
            let a_var = dstart.substring(0,dstart.indexOf("}}") + add_brace)
            a_var = parse_util.remove_white(a_var)
            found_vars[a_var] = ""
        }
        return found_vars
    }


    /**
     * 
     * Loads the top level file concerns named DB, mapping concerns to DB files associated with each template.
     * 
     * This method continues on to load all the DB file mentioned in the `concerns_named.db` file.
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
        for ( let concern in concerns ) {
            let concerns_dir = `[websites]/${concern}/`
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
                    let data_vars = this.find_substitutions_vars(data)
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
     * Given all the variables found in a file, for a concern,
     * this method creates JSON structured files (`.subst`)
     * A subst file is created for each file that a concern needs
     * for basic static pages and framework pages.
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
                        rec = subst_obj[namer][actor]
                        //
                        rec.name = namer
                        if ( namer.indexOf(actor) > 0 ){
                            actor = ""
                        }
                        actor = parse_util.capitalize(actor)
                        rec.file = `${namer}${actor}.txt`
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
            concerns_subst_map[concern] = {
            }
            //
            let var_set = subst_defs[concern].variables     // get the set of variables in use
            let subst_obj = this.get_subst_vars(concern,var_set)
            //
            let concerns_dir = `[websites]/${concern}/${this.created_dir}`
            concerns_dir = this.paths.compile_one_path(concerns_dir)
            let file_path = `${concerns_dir}/${concern}.subst`
            //
            let static_src = `[websites]/${concern}/static/${concern}.subst`
            static_src = this.paths.compile_one_path(static_src)
            let existing_subst = false
            if ( fos.pathExists(static_src) ) {
                existing_subst = await fos.load_json_data_at_path(static_src)
                if ( existing_subst !== false ) {
                    this.merge_existing_subst(subst_obj,existing_subst)
                }
            }
            //
            // The file containing sitewide variable mappings
            // this is the top level entry if specific files don't have one.
            concerns_subst_map[concern][concern] = {
                "path" : file_path,
                "vars" : Object.keys(var_set)
            }
            await fos.write_out_pretty_json(file_path,subst_obj,4)
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

        let subst_map_file = `[websites]/${this.project_dir}/concerns_to_subst_files.json`
        subst_map_file = this.paths.compile_one_path(subst_map_file)
        await fos.write_out_pretty_json(subst_map_file,concerns_subst_map,4)
    }


    /**
     * namer is a variable found in the file.
     * namer may be in the namer db of a concern, providing 
     * a calculation or a file description that will be kept with in a subst file.
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
