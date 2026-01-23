
const {spawn} = require('child_process')



class SysUtils {

    constructor(conf) {
        let where_are_scripts = conf.tools_directory
        this.generator_program =   `${where_are_scripts}/genpage.js`
    }


    spawn_generator(where_is_subst_file, where_is_template_file, where_does_output_go,where_is_static_dir) {
        //
        let spawner = spawn("node",[this.generator_program, where_is_subst_file, where_is_template_file, where_does_output_go, where_is_static_dir])
    
        spawner.stdout.on('data', (data) => {
            console.log(`stdout: ${data}`);
        });
        
        spawner.stderr.on('data', (data) => {
            console.error(`stderr: ${data}`);
        });
        
        spawner.on('close', (code) => {
            console.log(`child process exited with code ${code}`);
        });
        //
    }

}



module.exports = SysUtils