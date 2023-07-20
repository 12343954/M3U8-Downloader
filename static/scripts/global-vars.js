const taskStatus = {
    parsingFailed: 0,   //解析失败
    parsingM3U8ok: 1,   //资源解析成功，有 {count_seg} 个片段，开始下载...
    parsingLiveOk: 2,   //直播资源解析成功，开始下载
    multiAddOk: 3,      //批量添加成功，开始下载
    initializing: 4,    //初始化
    failedMultipleTimes: 5,  //多次尝试，下载片段失败
    noFFMPEG: 6,        //已完成，未发现本地FFMPEG，不能合成视频
    merging: 7,         //合并中[{percent}%]
    mergeFaild: 8,      //合并出错，请尝试手动合并
    downloadFaild: 9,  //下载失败，请检查链接有效性
    downloadMerging: 10,    //已完成，合并中...
    downloading: 11,    //下载中...{count_downloaded}/{count_seg} [{percent}]
    startMerge: 12,     //开始合并...
    mergeFailedMsg: 13,    //合并出错：{error}
    downloadLiveStreaming: 14,//下载直播中...
    downloadButFaild: 15,   //已完成，下载失败
    pause: 16,          //暂停
    done: 17,           //已完成
}

const httpHeader = {
    'user-agent': "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36 Edg/114.0.1823.41"
}

const percentFormatter = new Intl.NumberFormat('default', {
    style: 'percent',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
})

function percentFormat(num, total) {
    return percentFormatter.format(num / total);
}


module.exports = {
    taskStatus,
    httpHeader,
    percentFormat,
};