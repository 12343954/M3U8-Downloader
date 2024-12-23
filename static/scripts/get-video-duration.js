const fs = require('fs')

function getTime(buffer) {
    if (buffer.indexOf(Buffer.from('mvhd')) == -1) return 0;

    //如果buffer中含有mvhd字段，就计算，否则返回false
    const start = buffer.indexOf(Buffer.from('mvhd'));
    const box_size = buffer.readUInt32BE(start);
    const box_type = buffer.readUInt32BE(start + 4);
    const create_time = buffer.readUInt32BE(start + 8);
    const modi_time = buffer.readUInt32BE(start + 12);
    const timeScale = buffer.readUInt32BE(start + 16);
    const duration = buffer.readUInt32BE(start + 20);
    const movieLength = Math.floor(duration / timeScale);
    // console.log(start,box_size,box_type,create_time,modi_time,duration,timeScale,movieLength);//注释打开，就能看到更多的信息
    return movieLength;
}

async function read(path) {
    return new Promise((resolve, reject) => {
        fs.open(path, 'r', (err, fd) => {
            if (err) {
                reject(err)
            } else {
                resolve(fd)
            }
        })
    })
}

async function readfile(fd, buff, start_position) {
    return new Promise((resolve, reject) => {
        fs.read(fd, buff, 0, 10000, start_position, function (err, bytesRead, buffer) {
            if (err) {
                reject(err)
            } else {
                resolve(buffer)
            }
        })
    })
}

function formatTime(t) {
    let h = parseInt(t / 60 / 60 % 24)
    let m = parseInt(t / 60 % 60)
    let s = parseInt(t % 60)

    // 补零 如果小于10 则在前边进行补零 如果大于10 则不需要补零
    h = h < 10 ? '0' + h : h
    m = m < 10 ? '0' + m : m
    s = s < 10 ? '0' + s : s

    return `${h}:${m}:${s}`
}

// main
async function getVideoDuration(path) {
    // console.log(`start getVideoDuration: ${path}`)
    let start_position = 0
    let buff = Buffer.alloc(10000);
    let fd = await read(path);
    for (i = 0; i < 1000000; i++) {
        let buff_data = await readfile(fd, buff, start_position);
        const time = getTime(buff_data);
        if (time > 0) {
            // console.log(`end getVideoDuration: ${time} sec (loop=${i}) = ${formatTime(time)}`)
            i = 1000000;
            return formatTime(time);
        } else {
            start_position = start_position + 9900;
        }
    }
}

/**
 * [fileLengthFormat 格式化文件大小]
 * @param  {[int]} total [文件大小]
 * @param  {[int]} n     [total参数的原始单位如果为Byte，则n设为1，如果为kb，则n设为2，如果为mb，则n设为3，以此类推]
 * @return {[string]}       [带单位的文件大小的字符串]
 */
function fileLengthFormat(total, n) {
    var format;
    var len = total / (1024.0);
    if (len > 1000) {
        return arguments.callee(len, ++n);
    } else {
        switch (n) {
            case 1:
                format = len.toFixed(2) + " KB";
                break;
            case 2:
                format = len.toFixed(2) + " MB";
                break;
            case 3:
                format = len.toFixed(2) + " GB";
                break;
            case 4:
                format = len.toFixed(2) + " TB";
                break;
            case 5:
                format = len.toFixed(2) + " PB";
                break;
        }
        return format.replace(/\.00|(\.\d)0/, '$1');
    }
}

async function getVideoSize(path) {
    return new Promise((resolve, reject) => {
        fs.stat(path, (err, state) => {
            if (err) {
                reject(err)
            } else {
                // console.log(`file size = ${state.size}`)
                resolve(fileLengthFormat(state.size, 1))
            }
        })
    })
}

module.exports = {
    getVideoDuration,
    getVideoSize
};
