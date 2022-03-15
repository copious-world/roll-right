dir=$1
toplevel=$2
target=$3
echo $dir
bash ./tools/rungen.sh $dir $toplevel
bash ./tools/rungen_header_shell.sh $dir $toplevel
if [ ! -z "$target" ]; then
    echo "next --------------------------- "
    pwd
    echo $target
    if [ -d "$target" ]; then
        if [ ! -d "$target/html" ]; then
            mkdir ${target}/html
        fi
        if [ ! -d "$target/html/${dir}" ]; then
            mkdir ${target}/html/${dir}
        fi
        cp ${toplevel}/${dir}/*.html ${target}/html/${dir}/
    fi
fi
