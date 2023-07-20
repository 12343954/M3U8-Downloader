const en = {
    sidebar: {
        download: 'Download',
        settings: 'Settings'
    },
    tabs: {
        singleDownload: 'Single Download',
        multiDownload: `Multi Download`,
        mergeTS: `Merge TS`
    },
    newTask: {
        title: 'Create New Task',
        buttons: {
            confirm: 'Start it',
        },
        inputs: {
            url: {
                label: 'Source URL',
                holder: `Paste a 'm3u8' url or drag a 'm3u8' file here`,
            },
            taskName: {
                label: 'Task Name',
                holder: `[optional] Renamed the video name`,
            },
            httpHeaders: {
                label: 'Http Headers',
                holder: `[optional] One line one http header, For example:
                orgin: http://www.host.com
                refer: http://www.host.com`
            },
            privateKey: {
                label: 'Private Key',
                holder: `[optional] KEY-IV pairs (HEX format)`,
                content: `32-bit HEX format KEY and IV value，IV can be null
                e.g. ABABABABABBBBBBBABABABABABBBBBBBABABABABABBBBBBBABABABABABBBBBBB
                e.g. ABABABABABBBBBBBABABABABABBBBBBB`
            },
            merge: {
                label: 'After merging',
                holder: `Delete all ts files`,
            },
            urlPrefix:{
                label:`Url Prefix`,
                holder: `[optional] e.g. http://video.com/m3u8/12345678/`,
                content:`If M3U8 file is downloaded directly to the local and there is no URL (https) prefix in the file, you need to fill in it.
                If the TS video stream is in the M3U8 file directory, you do not need to fill in this field`
            }
        },
        tips: {
            addTaskMessage: 'Select an image quality',
        },
    },
    deleteTask: {
        title: 'Delete the task',
        buttons: {
            ok: 'Yes, do it',
            cancel: 'Cancel',
            withFile: 'Delete the file'
        }
    },
    singleDownload: {
        buttons: {
            newTask: 'New Task',
            clearCompletedTasks: `Clear completed ({finish}/{all})`,
        },
        tips: {
            openFolder: 'Open the folder',
            playVideo: 'Play the video',
            deleteVideo: 'Delete the video',
            noTasks: `You haven't added a download yet, let's try it
            'Create new task' can recognizes the clipboard automatically
            format: https://m3u8.url + space + video name`
        }
    },
    multiDownload: {
        buttons: {
            multiDownload: 'Start multiple downloads',
        },
        inputs: {
            m3u8Urls: {
                label: 'Multi M3U8',
                holder: `One line one M3U8 url，format: url----video name(optional), e.g.:
                https://host/index1.m3u8----1st video name
                https://host/index2.m3u8----2nd video name
                https://host/index3.m3u8`
            },
            headers: {
                label: 'Http Headers',
                holder: `[optional] One lin one header, e.g.:
                origin: http://www.host.com
                referer: http://www.host.com`,
            },
            afterMerge: {
                label: 'After merging',
                holder: `Delete all ts files`,
            }
        },
    },
    mergeTS: {
        buttons: {
            startMerge: 'Start merging',
            clearForm: 'Clear',
            quickMerge: 'Quick merge',
            fixMerge: 'Fix and merge (slow | transcoding)',
            openFolder: 'Open the folder',
            playVideo: 'Play the Video',
        },
        inputs: {
            tsDir: {
                label: 'Video Clips',
                holder: 'Select a directory containing TS streams or drag all TS files here'
            },
            tsTaskName: {
                label: 'Renamed',
                holder: '[optional] Current timestamp as default',
            },
            viewFile: 'View files',
            mergeProgress: 'Merge progress',
            log: 'Logs'
        },
        tips: {
            total: 'Import {total} ".ts" clips',
            select: '[{total}] video were selected',
        }
    },
    settings: {
        buttons: {
            browser: 'Select',
            viewLog: 'View Logs',
        },
        inputs: {
            saveFolder: {
                label: 'Save Folder',
                holder: 'Click the right button to select a storage folder'
            },
            log: {
                label: 'Logs',
            },
            proxy: {
                label: 'HTTP Proxy',
                holder: 'e.g. http://127.0.0.1:7890'
            },
            language: {
                label: 'Language',
                holder: '请输入HTTP代理(如：http://127.0.0.1:7890 )'
            }
        }
    },
    message: {
        hello: '{msg} world',
        title: 'Notice',
        enterM3U8: `Please enter M3U8 source url`,
        noSaveDir: `Please set the "Storage Folder" before downloading`,
        checkM3U8url: `Checking the m3u8 url ...`,
        m3u8UrlError: `Please enter the correct M3U8-URL or import (.m3u8) file`,
    },
    taskStatus: {
        parsingFailed: "Parsing Failed",
        parsingM3U8ok: "Resource OK, {count_seg} fragments, downloading...",
        parsingLiveOk: "Live resource parsing successfully, downloading...",
        multiAddOk: "Batch added OK, downloading...",
        initializing: "Initializing",
        failedMultipleTimes: "Download failed",
        noFFMPEG: "No FFMPEG, no merging.",
        merging: "Merging...[{percent}%]",
        mergeFaild: "Merging failed, try merging manually",
        downloadFaild: "Download failed, check M3U8 validity",
        downloadMerging: "Downloaded, merging...",
        downloading: "Downloading...{count_downloaded}/{count_seg} [{percent}]",
        startMerge: "Start merging...",
        mergeFailedMsg: "Merge faild: {error}",
        pause: "Pause...{count_downloaded}/{count_seg} [{percent}]",
        done: "",//Done
        downloadLiveStreaming: "Live Stream...[{count_downloaded}]",
        downloadButFaild: "Done, but failed"
    },
    unit: {
        bitrate: 'Bitrate',
        resolution: 'Resolution',
        link: 'Link',
    },
    about: {
        offical: 'Homepage',
        github: 'Github',
        version: 'Version',
        newVersion: 'new!'
    },
    buyMEcoffe: {
        title: 'Buy me a coffe',
        content: `Development is not easy. 
        If this app is useful to you, can you buy me a cup of coffee?
        Thanks in advance!`,
        button: 'Thanks for donation',
        wechat: 'WeChat',
        alipay: 'AliPay',
        paypal: 'PayPal',
    }
}

// export default en;