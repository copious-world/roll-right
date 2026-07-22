
const worker_thread_import_scheme = "importScripts('@bundle_location/@bundle_name')"
const main_page_import_scheme = "<script defer src='@bundle_location/@bundle_name'></script>"

/**
 * 
 * @param {string} bundle -- name of the file 
 * @param {object} page_or_worker_context 
 * @param {object} links_and_bundles
 */
function bundle_inclusion_transform(bundle,page_or_worker_context,links_and_bundles) {
    if ( !links_and_bundles ) {
        links_and_bundles = { bundle_location : '../js'}
    }
    //
    let btxt = ""
    if ( page_or_worker_context && (page_or_worker_context._page_type === "worker") ) {
        btxt = worker_thread_import_scheme.replace("@bundle_name",bundle)
    } else {
        btxt = main_page_import_scheme.replace("@bundle_name",bundle)
    }
    btxt = btxt.replace('@bundle_location',links_and_bundles.bundle_location)
    //
    return "\n" + btxt + "\n"
}


module.exports.bundle_inclusion_transform = bundle_inclusion_transform


const css_link = "<link rel='stylesheet' href='@css_location/@css_file'>"

/**
 * 
 * @param {string} bundle -- name of the file 
 * @param {object} page_or_worker_context 
 * @param {object} links_and_bundles
 */
function link_inclusion_transform(link_spec,page_or_worker_context,links_and_bundles) {
    if ( !links_and_bundles ) {
        links_and_bundles = { css_location : '../css'}
    }
    let type = 'css'
    link_spec = link_spec.substring(1)
    let link_parts = link_spec.split('>')
    type = link_parts[0]
    let type_file = link_parts[1]
    if ( type_file ) {
        type_file = type_file.replace('::','').trim()
        if ( type === 'css' ) {
            let ltxt = css_link.replace('@css_file',type_file)
            ltxt = ltxt.replace('@css_location',links_and_bundles.css_location)
            return "\n" + ltxt + "\n"
        } else {
            return ""
        }
    }
    //
    return ""
}


module.exports.link_inclusion_transform = link_inclusion_transform
