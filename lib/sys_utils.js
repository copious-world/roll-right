
const {execSync,spawn}  = require("child_process")
const fos = require("extra-file-class")()



class SysUtils {

    constructor(conf) { // this conf is constructed by the program or a class using this class. It is not the generate.json file.
        let where_are_scripts = conf.tools_directory
        this.generator_program =   `${where_are_scripts}/genpage.js`    // relative to the executing program...
    }

    /**
     * 
     * @param {*} concern 
     * @param {*} where_is_subst_file 
     * @param {*} where_is_template_file 
     * @param {*} where_does_output_go 
     * @param {*} where_is_static_dir 
     */
    spawn_generator(concern,where_is_subst_file, where_is_template_file, where_does_output_go,where_is_static_dir) {
        //
        let spawner = spawn("node",[this.generator_program, where_is_subst_file, where_is_template_file, where_does_output_go, where_is_static_dir, concern])
    
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


    /**
     * 
     * @param {*} cmd 
     * @param {*} arg 
     * @returns 
     */
    bash_command(cmd,arg) {
        try {
            return execSync(`bash ${cmd} ${arg}`)
        } catch(e) {
            console.log(e)
        }
    }

    /**
     * 
     * @param {*} cmd 
     * @param {*} args 
     */
    spawn_command(cmd,args) {
        spawn(cmd, args);
    }

    /**
     * 
     * @param {*} cmd 
     * @param {*} args 
     * @returns 
     */
    spawn_command_and_wait(cmd,args) {
        let p = new Promise((resolve,reject) => {
            let data = ""
            let err_data = ""
            let sp_cmd = spawn(cmd, args);
            sp_cmd.stderr.on('data',(chunk) => {
                err_data += chunk
            })
            sp_cmd.stdout.on('data',(chunk) => {
                data += chunk
            })
            sp_cmd.on('error',(err) => {
                console.log(err)
                reject(data,{err_data,"code" : -1})
            })
            sp_cmd.on('close',(code) => {
                resolve({data,err_data,code})
            })
        })
        return p
    }


}



module.exports = SysUtils