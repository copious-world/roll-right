
const {spawn} = require('child_process')


const {gsubst} = require('../lib/utils')

const {PathManager} = require('extra-file-class')
const fos = require('extra-file-class')()


// node genpage.js ${top_level}/${dir}/static/${dir}.subst ../templates/index.html ${top_level}/${dir}/index.html

class Phase2 {
    // ----
    constructor(target,target_conf) {
        this.tconf = target_conf
        this._target = target
        this.pm = new PathManager(conf)
    }


    config(tconf,target) {
        let static_artifacts = tconf.static_artifacts
        let where_is_subst_file = `${static_artifacts}/${target}.subst`
        where_is_subst_file = gsubst(where_is_subst_file,'$$target',target)
        where_is_subst_file = this.pm.translate_marker(where_is_subst_file,tconf)
        //
        let where_is_template_file = tconf.template
        where_is_template_file = gsubst(where_is_template_file,'$$target',target)
        where_is_template_file = this.pm.translate_marker(where_is_template_file,tconf)
        //
        let derived_output_file_name = tconf.template.substr(tconf.template.lastIndexOf('/'))
        //
        let where_does_output_go = tconf.out_dir
        where_does_output_go = gsubst(where_does_output_go,'$$target',target)
        where_does_output_go = this.pm.translate_marker(where_does_output_go,tconf)
        where_does_output_go += derived_output_file_name
        //
        let where_are_scripts = tconf.scripts_dir
        where_are_scripts = gsubst(where_are_scripts,'$$target',target)
        where_are_scripts = this.pm.translate_marker(where_are_scripts,tconf) + '/tools'

            console.log("----------------")
            console.log("subst: " + where_is_subst_file)
            console.log("template: " + where_is_template_file)
            console.log("output: " + where_does_output_go)
            console.log("tools: " + where_are_scripts)

        let generator_program =   `${where_are_scripts}/genpage.js`
        //

        let spawner = spawn("node",[generator_program, where_is_subst_file, where_is_template_file, where_does_output_go])
    
        spawner.stdout.on('data', (data) => {
            console.log(`stdout: ${data}`);
        });
        
        spawner.stderr.on('data', (data) => {
            console.error(`stderr: ${data}`);
        });
        
        spawner.on('close', (code) => {
            console.log(`child process exited with code ${code}`);
        });

    }

    run() {
        let out_dir = this.pm.translate_marker(this.tconf.out_dir,this.tconf)
        fos.ensure_directory(out_dir,this._target)
        this.config(this.tconf,this._target,this.tconf.template)
    }



}



module.exports = Phase2