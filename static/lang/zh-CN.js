const zhCN = {
    sidebar: {
        download: '资源下载',
        settings: '软件设置'
    },
    tabs: {
        singleDownload: 'M3U8视频下载',
        multiDownload: `M3U8批量下载`,
        mergeTS: `合并视频片段`
    },
    newTask: {
        title: '新建下载任务',
        buttons: {
            newTask: '新建下载',
            clearCompletedTasks: `清空已完成`,
            confirm: '开始下载',
        },
        inputs: {
            url: {
                label: '视频源',
                holder: `在线视频源地址，或将M3U8文件拖拽至此`,
            },
            taskName: {
                label: '任务名',
                holder: `[可空] 默认当前时间戳`,
            },
            httpHeaders: {
                label: '附加头',
                holder: `[可空] 一行一个Header，例如:
                orgin: http://www.host.com
                refer: http://www.host.com`
            },
            privateKey: {
                label: '私有KEY',
                holder: `[可空] KEY和IV值(HEX格式)`,
                content: `32位HEX格式KEY和32位IV值，IV值可空
                例如 ABABABABABBBBBBBABABABABABBBBBBBABABABABABBBBBBBABABABABABBBBBBB
                或者 ABABABABABBBBBBBABABABABABBBBBBB`
            },
            merge: {
                label: '合并完成',
                holder: `删除TS片段`,
            },
            urlPrefix: {
                label: `URL前缀`,
                holder: `[可空] 例如：http://video.com/m3u8/12345678/`,
                content: `如果M3U8文件是直接下载到本地的，并且文件里没有URL(https)前缀，则需要填写
                如果TS视频流在M3U8文件目录下，则不需要填写这块`
            }
        },
        tips: {
            addTaskMessage: '请选择一种画质',
        },
    },
    deleteTask: {
        title: '删除任务',
        buttons: {
            ok: '确 定',
            cancel: '取 消',
            withFile: '删除文件'
        }
    },
    singleDownload: {
        buttons: {
            newTask: '新建下载',
            clearCompletedTasks: `清空已完成 ({finish}/{all})`,
        },
        tips: {
            openFolder: '打开文件夹',
            playVideo: '播放',
            deleteVideo: '删除',
            noTasks: `您还没有添加下载任务，快来试试吧
            新建任务，能自动识别剪切板，省去繁琐操作
            格式：https://m3u8.url+空格+视频名字`
        }
    },
    multiDownload: {
        buttons: {
            multiDownload: '批量下载',
        },
        inputs: {
            m3u8Urls: {
                label: 'Multi M3U8',
                holder: `请输入一行一个M3U8视频源，格式：视频源----任务名（可空）,例如：
                https://host/index1.m3u8----第一个视频
                https://host/index2.m3u8----第二个视频
                https://host/index3.m3u8`
            },
            headers: {
                label: '附加头',
                holder: `[可空] 请输入一行一个Header，例如：
                Origin: http://www.host.com
                Referer: http://www.host.com`,
            },
            afterMerge: {
                label: '合并完成',
                holder: `删除TS片段`,
            }
        },
    },
    mergeTS: {
        buttons: {
            startMerge: '开始合并',
            clearForm: '清空',
            quickMerge: '快速合并',
            fixMerge: '修复合并 (慢|转码)',
            openFolder: '打开文件夹',
            playVideo: '播放视频',
        },
        inputs: {
            tsDir: {
                label: '视频片段',
                holder: '选择一个包含TS流的目录或将所有TS文件拖拽至此'
            },
            tsTaskName: {
                label: '新视频名',
                holder: '[可空] 默认当前时间戳',
            },
            viewFile: '查看文件',
            mergeProgress: '合并进度',
            log: '日志'
        },
        tips: {
            total: '共导入 {total} 个视频片段',
            select: '选择了 [{total}] 个视频',
        }
    },
    settings: {
        buttons: {
            browser: '浏览',
            viewLog: '查看日志',
        },
        inputs: {
            saveFolder: {
                label: '视频存储',
                holder: '请单击右侧按钮选择存储文件夹'
            },
            log: {
                label: '日志',
            },
            proxy: {
                label: 'HTTP代理',
                holder: '请输入HTTP代理(如：http://127.0.0.1:7890 )'
            },
            language: {
                label: '语言',
                holder: '请输入HTTP代理(如：http://127.0.0.1:7890 )'
            }
        }
    },
    message: {
        hello: '{msg} 全世界',
        title: '注意',
        enterM3U8: `请输入M3U8视频源`,
        noSaveDir: '请先设置存储路径，再开始下载视频',
        checkM3U8url: `正在检查链接...`,
        m3u8UrlError: `请输入正确的M3U8-URL或者导入(.m3u8)文件`,
    },
    taskStatus: {
        parsingFailed: "解析失败",
        parsingM3U8ok: "资源解析成功，有 {count_seg} 个片段，开始下载...",
        parsingLiveOk: "直播资源解析成功，开始下载...",
        multiAddOk: "批量添加成功，开始下载...",
        initializing: "初始化...",
        failedMultipleTimes: "多次尝试，下载片段失败",
        noFFMPEG: "已完成，未发现本地FFMPEG，不能合成视频",
        merging: "合并中...[{percent}%]",
        mergeFaild: "合并出错，请尝试手动合并",
        downloadFaild: "下载失败，请检查链接有效性",
        downloadMerging: "已完成，合并中...",
        downloading: "下载中...{count_downloaded}/{count_seg} [{percent}]",
        startMerge: "开始合并...",
        mergeFailedMsg: "合并出错：{error}",
        pause: "暂停...{count_downloaded}/{count_seg} [{percent}]",
        done: "",//已完成
        downloadLiveStreaming: "下载直播中...[{count_downloaded}]",
        downloadButFaild: "已完成，下载失败"
    },
    unit: {
        bitrate: '码率',
        resolution: '分辨率',
        link: '链接',
    },
    about: {
        offical: '官网',
        github: 'Github',
        version: '版本',
        newVersion: '新版本!'
    },
    buyMEcoffe: {
        title: '您的支持对我有莫大的帮助',
        content: `开发不易，如果您觉得此款软件对您有帮助，
        可以请小哥哥喝杯咖啡吗？我将非常感谢！`,
        button: '感谢您的赞助',
        wechat: '微信赞助',
        alipay: '支付宝赞助',
        paypal: 'PayPal赞助',
    }
}

// export default zhCN;