const TemplatesToPreStaging = require('../lib/TemplateToPreStaging')



let SysUtils = require('../lib/sys_utils')
let sys_utils = new SysUtils({
    "tools_directory" : "./tools"
})


/**
 * @class PreStagingSubsitutions
 * 
 * This class extends SkelToTemplate with operations specific to phase 3.
 * 
 * This is the page stage. All pages for all concerns are generated, using 
 * previously generated and edited substitutions and templates. 
 * 
 * The final results will be in the pre-staging directory for each concern.
 * 
 */
class PreStagingSubsitutions extends TemplatesToPreStaging {

    /**
     * 
     * @param {object} conf 
     */
    constructor(conf) {
        super(conf)
    }


    /**
     * 
     * This method is phase 3 method
     * 
     * @param {object} concerns 
     */
    async process_files(concerns) {
        for ( let concern in concerns ) {
            let concerns_dir = `[websites]/${concern}/`
            concerns_dir = this.paths.compile_one_path(concerns_dir)
            let targeted_files = Object.values(concerns[concern])
            for ( let pair of targeted_files ) {
                let keys = Object.keys(pair)
                for ( let ky of keys ) {
                    //
                    let static_dir = `${concerns_dir}/static`
                    let afile = `${concerns_dir}/${this.created_dir}${ky}`
                    let subst_form = ky.replace(".tmplt","_html.subst")
                    let subst_file = `${concerns_dir}/pre-staging/${subst_form}`
                    let ofile = subst_file.replace("_html.subst",".html")

console.log(afile,"-\n",subst_file,"==>\n",ofile)
                    sys_utils.spawn_generator(subst_file,afile,ofile,static_dir)
                }
            }
        }
    }

}


module.exports = PreStagingSubsitutions