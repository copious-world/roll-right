#!/usr/bin/env node

const fos = require('extra-file-class')()

// @target -- concern's directory for receiving templates
// @concern -- the business, app, tool, or other that is receiving a code asset into it's template, pre-staging, or staging directories
// @kernel  -- in script processing -- e.g. [app<scripts>]/file.js   -- as special code for a concern -- here, kenerl is 'scripts'
// @<type> -- a type specification 
// @params< -- the intake parameter descriptions for a sub-template file -- might be of type ".smplt"
// @list< -- parameter breakout for list entities 
// @nothing -- allows for a conditional to create empty lines for either positive or negative conditions
// @{}  -- configuration substitutions done before parsing a skeleton
//

// Minimist is a command line parsing package.
let g_argv = require('minimist')(process.argv.slice(2));

const SkelToTemplate = require('../lib/SkelToTemplate')
const TemplatesToPreStaging = require('../lib/TemplateToPreStaging')
const PreStagingSubsitutions = require('../lib/PreStagingSubsitutions')


/**
 * Addesses the use case available from the command line.
 * 
 * There are three cases, one for each phase of page generation starting 
 * from the first use of skeletons and ending with final pages.
 * 
 * 1. prepare
 * 2. template
 * 3. page (also can use 'assign' as in variable assignment that ends up on the page)
 * 
 * 
 * case 1:
 *  args.phase === 'prepare'
 *  args.sources -- directory where the generator file and other files for input and output will be found 
 *  args.generator -- the name of the JSON file that contains the map between inputs and outputs and directory overrides.
 *  args.structure -- where to put the intermediate parsing data for use in the next phase
 * 
 * Included in "package.json".scripts
 *  "prepare" : "node bin/index.js --phase prepare --sources ../websites/template-configs/  --generator generate.json --structure parsed.json"
 * 
 * npm default command:
 *  npm run prepare
 * 
 * CLI cmd:
 * 
 * roll-right --phase prepare --sources ../websites/template-configs/  --generator generate.json --structure parsed.json
 * 
 * case 2:
 *  args.phase === 'template'
 *  args.sources -- directory where the generator file and other files for input and output will be found 
 *  args.generator -- the name of the JSON file that contains the map between inputs and outputs and directory overrides.
 *  args.structure -- where to put the intermediate parsing data for use in the next phase
 * 
 * Included in "package.json".scripts
 *  "templates" : "node bin/index.js --phase template --sources ../websites/template-configs/ --generator generate.json --structure parsed.json"
 * 
 * npm default command:
 *  npm run templates
 * 
 * CLI cmd:
 * 
 * roll-right --phase template --sources ../websites/template-configs/ --generator generate.json --structure parsed.json
 * 
 * case 3:
 *  args.phase === 'templates'
 *  args.values -- name of a conf file that contains global values for the websites and other substitution information
 * 
 * Included in "package.json".scripts
 *  "page" : "node bin/index.js --phase assign --sources ../websites/template-configs/ --values assignments.json"
 * 
 * roll-right --phase assign --sources ../websites/template-configs/ --values assignments.json
 * 
 * 
 * @param {object} args - the data structure returned by minimist
 */
async function command_line_operations_new(args) {
    let phase = args.phase
    //
    if ( phase ) {
        //
        console.log("Operating phase:\t\t\t\t\t", phase)
        switch ( args.phase ) {
            case "prepare" :
            case 1: {                       /// creates templates
                let project_dir = args.sources  // for instance [website]/template-configs
                let generator = args.generator  // a string ... for instance generate.json
                generator = `${project_dir}${generator}`
                console.log("Using input configuration for generator:\t\t",generator)
                //
                let parsed = args.structure
                parsed = `${project_dir}${parsed}`
                console.log("Using output to configuration for template formation:\t\t",parsed)

                // only works if there is a configuration file
                let conf = await fos.load_json_data_at_path(generator)
                if ( conf ) {
                    conf.top_level_parsed = parsed    // path to output in the template configuration directory (use globally)
                    let to_templates = new SkelToTemplate(conf)
                    to_templates.set_project_directory(project_dir)
                    await to_templates.prepare_directories()  // makes sure the output directories exists (in any case)
                    let parsed_skels = await to_templates.skeleton_unification()        // parsing and primary evaluations
                    await to_templates.generate_all_concerns_templates(parsed_skels)    // generate template HTML
                }
                break
            }
            case "template" :
            case 2: {
                let project_dir = args.sources
                let generator = args.generator  // a string
                generator = `${project_dir}${generator}`
                console.log("Using input configuration from generation:\t\t",generator)
                //
                let parsed = args.structure
                parsed = `${project_dir}${parsed}`
                console.log("Using input configuration for template formation:\t\t",parsed)
                let conf = await fos.load_json_data_at_path(generator)
                if ( conf ) {
                    let to_templates = new SkelToTemplate(conf)
                    to_templates.set_project_directory(project_dir)
                    await to_templates.prepare_directories()        // needed even when loading previously parsed data.
                    let parsed_skels = await fos.load_json_data_at_path(parsed)
                    let concerns = false
                    if ( parsed_skels ) {
                        // regenerates with changes provided by custom settings developed after the prepare 
                        // stage of the processing. This will be out of the way before any substitution 
                        // objects are created.
                        concerns = await to_templates.generate_all_concerns_templates(parsed_skels)
                    } else {
                        console.log("did not load " + parsed)
                    }
                    // If the customized regeneration process has succeeded, then create susbtitution 
                    // objects. 
                    if ( concerns ) {
                        let to_pre_staging = new TemplatesToPreStaging(conf)
                        to_pre_staging.set_project_directory(project_dir)
                        let subst_defs = await to_pre_staging.prepare_files_and_substitutions(concerns)
                        await to_pre_staging.publish_subs_defs(subst_defs)
                    }
                    //
                }
                break
            }
            case "page"   :
            case "assign" :
            case 3: {
                //
                let project_dir = args.sources
                let substitutions = args.values
                substitutions = `${project_dir}${substitutions}`
                console.log("Using input configuration for assignments:\t\t",substitutions)
                //
                let conf = await fos.load_json_data_at_path(substitutions)
                if ( conf ) {
                    //
                    let to_pre_staging = new PreStagingSubsitutions(conf)
                    to_pre_staging.set_project_directory(project_dir)
console.log(to_pre_staging.project_dir)
                    let concerns_file = `${to_pre_staging.project_dir}/concerns_to_files.json`
console.log("concerns file",concerns_file)
                    let concerns = await fos.load_json_data_at_path(concerns_file)
                    await to_pre_staging.process_files(concerns)
                    //
                }
                //
                break
            }
            default : {
                console.log("unnown phase")
                break;
            }
        }
        //
    } else {
    console.log("-------------------------------------------------------------")
        let usage = `
The configuration file will be found in the sources directory.

phase 1:
roll-right --phase prepare --sources <directory containing configuration files>  --generator <name of config file>.json --structure <name of file to output parsing structure>.json

phase 2:
roll-right --phase template --sources <directory containing configuration files> --generator <name of config file>.json --structure <name of file to input parsing structure>.json

phase 3:
roll-right --phase assign --sources <directory containing configuration files> --values <variable substitutions site-wide>.json
        `
        console.log(usage)
    }

    console.log("-------------------------------------------------------------")

}


console.log("-------------------------------------------------------------")
console.log("roll-right static content management and module publication")
console.log("-------------------------------------------------------------")

// command_line_operations()


command_line_operations_new(g_argv)