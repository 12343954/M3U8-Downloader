//#region // imports
const os = require('os')
const {
    app,
    BrowserWindow,
    Tray,
    ipcMain,
    shell,
    Menu,
    dialog,
    screen,
    session,
    nativeImage
} = require('electron');
const isDev = require('electron-is-dev');
const util = require('util');
const exec = util.promisify(require('child_process').exec);
const path = require('path');
const { Parser } = require('m3u8-parser');
const fs = require('fs');
const async = require('async');
const crypto = require('crypto');
const got = require('got');
const { Readable } = require('stream');
const ffmpeg = require('fluent-ffmpeg');
const package_self = require('./package.json');
const appInfo = package_self;
const winston = require('winston');
const nconf = require('nconf');
const ffmpegPath = require('ffmpeg-static').replace(/app.asar[\/\\]{1,2}/g, '');
const contextMenu = require('electron-context-menu');
const Aria2 = require('aria2');
const forever = require('forever-monitor');
const filenamify = require('filenamify');
const { HttpProxyAgent, HttpsProxyAgent } = require('hpagent');
const { taskStatus, httpHeader, percentFormat, dateFormat } = require('./static/scripts/global-vars')
const { getVideoDuration, getVideoSize } = require('./static/scripts/get-video-duration')
const { createDownloadHelpers } = require('./src/main/download-utils')
const { createTaskRuntime } = require('./src/main/task-runtime')
const { resolveHttpUri, resolveMediaUri, resolveKeyUri } = require('./src/main/url-resolver')
const { createTaskState } = require('./src/main/task-state')

const i18n = require('./locales/i18n')
//#endregion
i18n.setLocale('en')

contextMenu({
    showCopyImage: false,
    showCopyImageAddress: false,
    showInspectElement: false,
    showServices: false,
    showSearchWithGoogle: false
});

// const dateFormat = (dt) => {
//     return new Date(dt.getTime() - dt.getTimezoneOffset() * 60000).toISOString().replace(/T|(\.\d+Z)/g, ' ').trim()
// }

const pathConfigDir = app.getPath('userData');
const pathConfigFile = path.join(pathConfigDir, 'config.json');
const pathVideoDB = path.join(pathConfigDir, 'config_videos.json');
const aria2Dir = path.join(app.getAppPath(), "static", "aria2", process.platform);
const aria2_app = path.join(aria2Dir, "aria2c.exe");
const aria2_config = path.join(aria2Dir, "aria2.conf");

let isdelts = true;
let mainWindow = null;
let playerWindow = null;
let splashWindow = null;
let tray = null;
let AppTitle = 'M3U8 Downloader';
let firstHide = true;

let videoDatas = [];
const taskRuntime = createTaskRuntime();
let aria2Client = null;
let aria2Server = null;
let proxy_agent = null;
let pathDownloadDir;

const httpTimeout = {
    socket: 30000,
    request: 30000,
    response: 60000
};

const referer = `https://tools.heisir.cn/M3U8Soft-Client?v=${package_self.version}`;
const github_repo = `12343954/M3U8-Downloader`

function transformConfig(config) {
    const result = []
    for (const [k, v] of Object.entries(config)) {
        if (v !== '') {
            result.push(`--${k}=${v}`)
        }
    }
    return result
}

const logger = winston.createLogger({
    level: 'debug',
    format: winston.format.combine(
        winston.format.timestamp({
            format: 'YYYY-MM-DD HH:mm:ss'
        }),
        winston.format.printf(info => `${info.timestamp} ${info.level}: ${info.message}` + (info.splat !== undefined ? `${info.splat}` : " "))
    ),
    transports: [
        new winston.transports.Console(),
        new winston.transports.File({
            filename: path.join(pathConfigDir, 'logs/error.log'),
            level: 'error'
        }),
        new winston.transports.File({
            filename: path.join(pathConfigDir, 'logs/all.log')
        }),
    ],
});
// logger.info(`pathConfigDir= ${pathConfigDir}`);
logger.info(`pathConfigFile= ${pathConfigFile}`);
// logger.info(`pathVideoDB= ${pathVideoDB}`);

const {
    safeUnlink,
    safeRemoveDir,
    getTaskDir,
    downloadFileWithRetry
} = createDownloadHelpers({
    logger,
    isTaskActive: taskRuntime.isActive
});

const taskState = createTaskState({
    taskStatus,
    i18n,
    percentFormat
});

if (!fs.existsSync(pathConfigDir)) {
    fs.mkdirSync(pathConfigDir, {
        recursive: true
    });
}

nconf.argv().env()
try {
    nconf.file({
        file: pathConfigFile
    })
} catch (error) {
    logger.error('Please correct the mistakes in your configuration file: [%s].\n' + error, configFilePath)
}


process.on('uncaughtException', (err, origin) => {
    logger.error(`uncaughtException: ${JSON.stringify(err)} | ${JSON.stringify(origin)}`)
});
process.on('unhandledRejection', (reason, promise) => {
    logger.error(`unhandledRejection: ${JSON.stringify(promise)} | ${JSON.stringify(reason)}`)
    logger.error(`Unhandled Rejection at: ${JSON.stringify(promise)} reason: ${JSON.stringify(reason)}`);
});

console.log(`\n\n----- ${appInfo.name} | v${appInfo.version} | ${os.platform()} -----\n\n`)
// logger.info(`pathConfigDir= ${pathConfigDir}`);
logger.info(`config  loaded, at= ${pathConfigFile}`);
// logger.info(`pathVideoDB= ${pathVideoDB}`);

function createWindow() {
    // main window
    let _workAreaSize = screen.getDisplayNearestPoint(screen.getCursorScreenPoint()).workAreaSize;

    splashWindow = new BrowserWindow({
        width: 500,
        height: 300,
        transparent: true,
        frame: false,
        alwaysOnTop: true
    });

    splashWindow.loadFile(path.join(__dirname, 'static', 'splash.html'));
    splashWindow.center();
    setTimeout(function () {
        splashWindow.close();
        mainWindow.center();
        mainWindow.show();
    }, 2000);


    mainWindow = new BrowserWindow({
        width: 1000,// _workAreaSize.width * 0.6,
        height: 620,//_workAreaSize.height * 0.7,
        minWidth: 1000,
        minHeight: 620,
        center: true,
        frame: (process.platform == 'darwin'),
        resizable: true,
        webPreferences: {
            nodeIntegration: true,
            spellcheck: false,
            contextIsolation: false,
            webviewTag: true
        },
        icon: path.join(__dirname, 'static', 'icon', 'logo.png'),
        alwaysOnTop: false,
        hasShadow: false,
        title: `${AppTitle}`,// ${package_self.version}
        show: false,
    });
    mainWindow.setMenu(null);
    mainWindow.loadFile(path.join(__dirname, 'static', 'mainFrm.html'));
    isDev && mainWindow.openDevTools();
    mainWindow.on('closed', () => mainWindow = null);
    mainWindow.webContents.on('dom-ready', (e) => {
        const lang = nconf.get('language')
        i18n.setLocale(lang);
        updateContextMenu();
        // logger.info(`${lang} = ${i18n.t('message.hello')}`)

        // videoDatas.filter(k => {
        //     if (k.status == taskStatus.pause) {
        //         const _tmp = path.join(pathDownloadDir, `${k.taskName}.mp4`)
        //         if (fs.existsSync(_tmp)) {
        //             k.status = taskStatus.done; // 已完成
        //             k.statusText = i18n.t('task.done') // 已完成
        //             k.videopath = _tmp
        //         }
        //     }
        // });

        const save_dir = pathDownloadDir || '';
        let tags = nconf.get('tags') || [];
        let taskTag = nconf.get('taskTag') || '';
        let categories = nconf.get('categories');
        if (categories && categories.length > 0) {
            if (taskTag) {
                categories.map(p => {
                    p.select = p.tag == taskTag;
                })
            } else {
                categories.map((p, i) => {
                    p.select = i == 0;
                })
            }
        }
        else {
            if (tags && tags.length > 0) {
                categories = tags.map(p => ({ tag: p, dir: save_dir, select: p == taskTag }))
            } else {
                categories = [{ tag: "Movie", dir: save_dir, select: true }]
            }
        }
        nconf.set('categories', categories);
        nconf.save();

        e.sender.send('message', {
            version: package_self.version,
            config_save_dir: pathDownloadDir,
            config_ffmpeg: ffmpegPath,
            config_proxy: nconf.get('config_proxy'),
            config_tags: tags,
            config_categories: categories,
            config_taskTag: nconf.get('taskTag') || '',
            config_language: lang,
            config_closeAppBehavior: nconf.get('closeApp') || 0,
            platform: process.platform,
            videoDatas,
            isDev,
        });

        saveDBdisk();

        // logger.info(`===mainWindow.webContents.on('dom-ready')鏃剁殑videoDatas=${JSON.stringify(videoDatas)}`)
        // e.sender.setTitle(`${AppTitle} ${package_self.version}`)
    })
    mainWindow.webContents.setWindowOpenHandler((details) => {
        shell.openExternal(details.url);
        return { action: 'deny' };
    });
}

function createPlayerWindow(src) {
    let title = src.split(path.sep);
    title = title[title.length - 1];

    let isTop = nconf.get('alwaysOnTop')
    if (isTop === undefined) isTop = true
    // logger.info(`isTop = ${isTop}, type= ${typeof(isTop)}`)

    if (playerWindow == null) {
        // player window
        // let _workAreaSize = screen.getDisplayNearestPoint(screen.getCursorScreenPoint()).workAreaSize;

        playerWindow = new BrowserWindow({
            title: title,
            width: 1000,//_workAreaSize.width * 0.6,
            height: 700,//_workAreaSize.height * 0.7,
            minWidth: 480,
            minHeight: 270,
            skipTaskbar: false,
            transparent: false,
            frame: (process.platform == 'darwin'),
            resizable: true,
            webPreferences: {
                nodeIntegration: true,
                contextIsolation: false
            },
            icon: path.join(__dirname, 'static', 'icon', 'logo.png'),
            alwaysOnTop: isTop,
            hasShadow: false,
            parent: mainWindow
        });
        playerWindow.setMenu(null)
        playerWindow.on('closed', () => playerWindow = null);
        playerWindow.loadFile(path.join(__dirname, 'static', 'player.html'));
        playerWindow.webContents.on('dom-ready', (e) => {
            e.sender.send('message', {
                platform: process.platform, playsrc: src, title, isTop
            });
        });
        isDev && playerWindow.openDevTools();
        return;
    }
    playerWindow.webContents.send('message', {
        platform: process.platform, playsrc: src, title, isTop
    });
    playerWindow?.show()
    playerWindow?.setAlwaysOnTop(isTop);
    playerWindow?.focus();
}

// 9999.9999.9999 > 1.1.1 最高支持4位版本对比，如：1.2.1 > 1.2.0   1.3 > 1.2.9999
function str2float(v) {
    v = v.replace('v', '')
    let va = v.split('.', 4);
    if (!va) return -1;
    let _r = 0;
    let base = 100000000.0;
    va.forEach(k => _r += (base * k), base /= 10000);
    return _r;
}

let _updateInterval;
async function checkUpdate() {
    const {
        body
    } = await got(`https://api.github.com/repos/${github_repo}/releases/latest`)// CpuGpuTemper
        .catch(logger.error);
    if (!body) return appInfo.version;


    try {
        let _package = JSON.parse(body);
        return _package.tag_name;

        // if (str2float(_package.tag_name) <= str2float(package_self.version))
        //     return;

        // _updateInterval && (clearInterval(_updateInterval), _updateInterval = null);

        // if (dialog.showMessageBoxSync(mainWindow, {
        //     type: 'question',
        //     buttons: ["Yes", "No"],
        //     message: i18n.t('system.newVersion', { version: _package.version }) // 检测到新版本，是否要打开升级页面，下载最新版
        // }) == 0) {
        //     shell.openExternal(`https://github.com/${github_repo}/releases`);
        //     return;
        // }
    } catch (error) {
        logger.error(error);
        return appInfo.version;
    }
}

function webRequestReq(details, callback) {
    if (!details.webContentsId || details.webContentsId == mainWindow.webContents.id) {
        callback({ cancel: false }); return
    }
    const id = details.webContentsId;
    if (/http.*\.((mp4)|(m3u8)|(flv)|(mp3)|(mpd)|(wav))(\?|$)/.test(details.url)) {
        let [_null, _type] = details.url.match(/http.*\.((mp4)|(m3u8)|(flv)|(mp3)|(mpd)|(wav))(\?|$)/);

        logger.debug(JSON.stringify(details));
        let _item = {
            type: _type.toUpperCase(),
            url: details.url,
            headers: JSON.stringify(details.requestHeaders)
        }
        mainWindow && mainWindow.webContents.send('message', { browserVideoItem: _item })
    }

    callback({ cancel: false });
};

function webRequestRsp(details) {
    if (!details.webContentsId || details.webContentsId == mainWindow.webContents.id) {
        return
    }
    const id = details.webContentsId;
    /http.*\.((mp4)|(m3u8)|(flv)|(mp3)|(mpd)|(wav))(\?|$)/.test(details.url) &&
        logger.debug("rsp\t" + details.url);
}

app.on('ready', () => {

    // Run as one instance app
    if (!app.requestSingleInstanceLock()) {
        app.quit();
        return
    }
    app.on('second-instance', (event, argv, cwd) => {
        if (mainWindow) {
            if (mainWindow.isMinimized()) {
                mainWindow.restore()
            } else if (mainWindow.isVisible()) {
                mainWindow.focus()
            } else {
                mainWindow.show()
                mainWindow.focus()
            }
        } else {
            app.quit();
        }
    });

    createWindow();

    let iconImg = nativeImage.createFromPath(path.join(__dirname, 'static', 'icon', 'logo.png'));
    tray = new Tray(iconImg.resize({ width: 20, height: 20 }));
    tray.setToolTip(AppTitle);
    tray.on("double-click", () => {
        mainWindow && mainWindow.show();
    });

    updateContextMenu();

    try {
        videoDatas = JSON.parse(fs.readFileSync(pathVideoDB))?.map(k => {
            if (taskState.canRestoreAsPaused(k.status)) {
                taskState.pauseTask(k);
            }
            return k;
        });
        if (videoDatas && videoDatas.length > 0) {
            videoDatas = videoDatas.map((k) => {
                if (k.segment_total == k.segment_downloaded && k.status != taskStatus.done) {
                    // console.log(k.segment_total, k.segment_downloaded, k.status, taskStatus.done)
                    // 已完成
                    k.status = taskStatus.done; // 已完成
                    k.statusText = i18n.t('task.done') // 已完成
                    k.videopath = k.dir + '.mp4'
                }
                return k;
            })
        }
        logger.info(`VideoDB loaded, at= ${pathVideoDB}`);
        // logger.error(JSON.stringify(pathVideoDB));

        // 初始化断点下载运行状态。
        taskRuntime.resetFromTasks(videoDatas, false)
        // logger.error(`成功设置断点数据库，globalTaskStatusDic=${JSON.stringify(globalTaskStatusDic)}`);

    } catch (error) {
        logger.error(`[FAILED]read pathVideoDB, at=${pathVideoDB}`);
        logger.error(error)
    }

    pathDownloadDir = nconf.get('SaveVideoDir');

    const config_proxy = nconf.get('config_proxy');
    // let httpProxy = new HttpProxyAgent({
    //     keepAlive: true,
    //     keepAliveMsecs: 1000,
    //     maxSockets: 256,
    //     maxFreeSockets: 256,
    //     scheduling: 'lifo',
    //     proxy: config_proxy
    // });
    // proxy_agent = config_proxy ? {
    //     http: httpProxy,
    //     https: httpProxy
    // } : null;

    proxy_agent = config_proxy ? {
        http: new HttpProxyAgent({
            keepAlive: true,
            keepAliveMsecs: 1000,
            maxSockets: 256,
            maxFreeSockets: 256,
            scheduling: 'lifo',
            proxy: config_proxy
        }),
        https: new HttpsProxyAgent({
            keepAlive: true,
            keepAliveMsecs: 1000,
            maxSockets: 256,
            maxFreeSockets: 256,
            scheduling: 'lifo',
            proxy: config_proxy
        })
    } : null;

    //session.defaultSession.webRequest.onBeforeRequest(webRequestReq);
    session.defaultSession.webRequest.onBeforeSendHeaders(webRequestReq);
    session.defaultSession.webRequest.onResponseStarted(webRequestRsp);

    // 百度统计代码
    /*
    false && (async () => {
        try {
            checkUpdate();
            _updateInterval = setInterval(checkUpdate, 600000);

            let HMACCOUNT = nconf.get('HMACCOUNT');
            if (!HMACCOUNT) HMACCOUNT = '';
            const {
                headers
            } = await got("http://hm.baidu.com/hm.js?300991eff395036b1ba22ae155143ff3", {
                headers: {
                    "Referer": referer,
                    "Cookie": "HMACCOUNT=" + HMACCOUNT
                }
            });
            try {
                HMACCOUNT = headers['set-cookie'] && headers['set-cookie'][0].match(/HMACCOUNT=(.*?);/i)[1];
                if (HMACCOUNT) {
                    nconf.set('HMACCOUNT', HMACCOUNT);
                    nconf.save();
                }
            } catch (error_) {
                logger.error(error_)
            }
            await got(`http://hm.baidu.com/hm.gif?hca=${HMACCOUNT}&cc=1&ck=1&cl=24-bit&ds=1920x1080&vl=977&ep=6621%2C1598&et=3&ja=0&ln=zh-cn&lo=0&lt=${(new Date().getTime() / 1000)}&rnd=0&si=300991eff395036b1ba22ae155143ff3&v=1.2.74&lv=3&sn=0&r=0&ww=1920&u=${encodeURIComponent(referer)}`, {
                headers: {
                    "Referer": referer,
                    "Cookie": "HMACCOUNT=" + HMACCOUNT
                }
            });
            await got(`http://hm.baidu.com/hm.gif?cc=1&ck=1&cl=24-bit&ds=1920x1080&vl=977&et=0&ja=0&ln=zh-cn&lo=0&rnd=0&si=300991eff395036b1ba22ae155143ff3&v=1.2.74&lv=1&sn=0&r=0&ww=1920&ct=!!&tt=M3U8Soft-Client`, {
                headers: {
                    "Referer": referer,
                    "Cookie": "HMACCOUNT=" + HMACCOUNT
                }
            });
            logger.info("call baidu-tong-ji end.");
        } catch (error) {
            logger.error(error)
        }
    })();
    */
    return;

    const EMPTY_STRING = '';
    const systemConfig = {
        'all-proxy': EMPTY_STRING,
        'allow-overwrite': false,
        'auto-file-renaming': true,
        'check-certificate': false,
        'continue': false,
        'dir': app.getPath('downloads'),
        'max-concurrent-downloads': 120,
        'max-connection-per-server': 5,
        'max-download-limit': 0,
        'max-overall-download-limit': 0,
        'max-overall-upload-limit': '256K',
        'min-split-size': '1M',
        'no-proxy': EMPTY_STRING,
        'pause': true,
        'rpc-listen-port': 16801,
        'rpc-secret': EMPTY_STRING,
        'seed-ratio': 1,
        'seed-time': 60,
        'split': 10,
        'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36 Edg/143.0.0.0'
    }

    let cmds = [aria2_app, `--conf-path=${aria2_config}`];
    cmds = [...cmds, ...transformConfig(systemConfig)];
    logger.debug(cmds.join(' '));

    let instance = forever.start(cmds, {
        max: 10,
        parser: function (command, args) {
            logger.debug(command, args);
            return {
                command: command,
                args: args
            }
        },
        silent: false
    });
    instance.on('start', function (process, data) {
        let aria2 = new Aria2({
            port: 16801
        });
        aria2.open();
        aria2.on('close', (e) => {
            logger.debug('----aria2 connect close----');
            setTimeout(() => aria2.open(), 100);
        });
        aria2.on("onDownloadComplete", downloadComplete);
        aria2Client = aria2;

        setInterval(() => {
            aria2Client.call('getGlobalStat').then((result) => {
                if (result && result['downloadSpeed']) {
                    var _speed = '';
                    var speed = parseInt(result['downloadSpeed']);
                    _speed = (speed < 1024 * 1024) ? Math.round(speed / 1024) + ' KB/s' : (speed / 1024 / 1024).toFixed(2) + ' MiB/s'
                    mainWindow.webContents.send('message', { downloadSpeed: _speed });
                }
            });
        }, 1500);
    });
    aria2Server = instance;
});

function updateContextMenu() {
    if (!tray) return;

    const contextMenu = Menu.buildFromTemplate([{
        label: i18n.t('system.contextMenu.showMainWindow'),// '显示窗口',
        type: 'normal',
        click: () => {
            mainWindow.show();
        }
    },
    {
        type: 'separator'
    },
    {
        label: i18n.t('system.contextMenu.exit'),// '退出',
        type: 'normal',
        click: () => {
            aria2Server && aria2Server.stop();
            playerWindow && playerWindow.close();
            mainWindow && mainWindow.close();
            setTimeout(app.quit.bind(app), 1000);
        }
    }
    ]);

    tray.setContextMenu(contextMenu);
}

function downloadComplete(e) {
    logger.debug('---- aria2 downloadComplete ----');
    var gid = e[0]['gid'];

    logger.debug(gid);
}

// 当全部窗口关闭时退出。
app.on('window-all-closed', async () => {

    console.log('window-all-closed')

    /*
    let HMACCOUNT = nconf.get('HMACCOUNT');
    HMACCOUNT && await got(`http://hm.baidu.com/hm.gif?cc=1&ck=1&cl=24-bit&ds=1920x1080&vl=977&et=0&ja=0&ln=zh-cn&lo=0&rnd=0&si=300991eff395036b1ba22ae155143ff3&v=1.2.74&lv=1&sn=0&r=0&ww=1920&ct=!!&tt=M3U8Soft-Client`, {
        headers: {
            "Referer": referer,
            "Cookie": "HMACCOUNT=" + HMACCOUNT
        }
    });
    */

    if (nconf.get('closeApp')) {
        aria2Server && aria2Server.stop();
        playerWindow && playerWindow.close();
        mainWindow && mainWindow.close();
        setTimeout(app.quit.bind(app), 1000);
        return
    }

    // 在 macOS 上，除非用户用 Cmd + Q 确定退出，
    // 否则大部分应用及其菜单栏会保持激活。
    if (process.platform !== 'darwin') {
        tray && tray.destroy();
        tray = null;
        app.quit();
    };
})

app.on('activate', () => {
    // 在 macOS 上，当单击 Dock 图标并且没有其他窗口打开时，
    // 通常在应用程序中重新创建一个窗口。
    if (mainWindow === null) {
        createWindow()
    } else {
        mainWindow.show();
    }
})

ipcMain.on('window-minimize', () => {
    mainWindow.minimize()

    // const f = new ffmpeg()
    //     .addInputOptions([
    //         // '-hwaccel',
    //         '-h'
    //     ])
    //     .on('start', cmdline => {
    //         console.log(`start: ${cmdline} ----------------`)
    //     })
    //     .on('end', (out, err) => {
    //         console.log('end -------------------')
    //         console.log(out)
    //     })
    //     .on('progress', progress => {
    //         console.log(progress)
    //     })
    // f.run()

    // try {
    //     exec('ffmpeg -hwaccels', [''], (err, stdout, stderr) => {
    //         if (err) {
    //             console.log(stderr);
    //         }

    //         console.log('\nffmpeg -hwaccels:\n---------------------\n');
    //         console.log(stdout);
    //         console.log('\n\n');

    //     });
    // } catch (err) {
    //     console.log(` error: ${JSON.stringify(err)} \n\n`)
    // }


})

ipcMain.on('window-toggle-maximize', () => {
    if (mainWindow.isMaximized()) {
        mainWindow.unmaximize();
    } else {
        mainWindow.maximize();
    }
})

ipcMain.on("hide-windows", function () {
    const closeApp = nconf.get('closeApp') || 0;
    if (closeApp) {
        aria2Server && aria2Server.stop();
        playerWindow && playerWindow.close();
        mainWindow && mainWindow.close();
        setTimeout(app.quit.bind(app), 1000);
    } else {
        mainWindow && mainWindow.hide(), (firstHide && tray && (tray.displayBalloon({
            icon: path.join(__dirname, 'static', 'icon', 'logo-512.png'),
            title: i18n.t('message.title'),// "提示",
            content: i18n.t('message.hideWindow'),// "双击显示主窗口"
        }), firstHide = false));
    }
});

ipcMain.on('open-log-dir', function (event, arg) {
    showDirInExploer(path.join(pathConfigDir, 'logs'))
});

ipcMain.on('task-clear', async function (event, object) {
    // videoDatas.forEach((video) => {
    //     globalTaskStatusDic[video.id] = false;
    // })
    // videoDatas = [];

    // 清除已完成任务。
    videoDatas = videoDatas.filter(k => k.status != taskStatus.done)
    saveDBdisk()
});

ipcMain.on('task-add', async function (event, object) {
    let m3u8_url = object.url;
    let _headers = {};
    let code = -1;
    let info = i18n.t('task.parsingFailed') // 解析资源失败

    // const pathDownloadDir = nconf.get('SaveVideoDir');
    const pathDownloadDir = object.dir;
    const folderExist = fs.existsSync(pathDownloadDir);

    let parser = new Parser();
    //#region // headers
    if (object.headers) {
        let heads = object.headers.split(/\n|\r/g);
        heads && heads.forEach(head => {
            var kv = head.split(/:/g)
            // console.log(kv)
            if (kv[0] == '') _headers[`:${kv[1]}`] = kv.slice(2).join(':')
            else _headers[`${kv[0]}`] = kv.slice(1).join(':')
        });
    }

    let mes = m3u8_url.match(/^https?:\/\/[^/]*/);
    let _hosts = '';
    if (mes && mes.length >= 1) {
        _hosts = mes[0];

        if (_headers['Origin'] == null && _headers['origin'] == null) {
            _headers['Origin'] = _hosts;
        }
        if (_headers['Referer'] == null && _headers['referer'] == null) {
            _headers['Referer'] = _hosts;
        }
    }
    //#endregion

    object.headers = { ...httpHeader, ..._headers };
    object.time = dateFormat(new Date(), "yyyy-mm-dd HH:MM:ss");
    if (!folderExist) {
        object.status = taskStatus.saveFolderNoExist;
        object.statusText = i18n.t('task.saveFolderNoExist');

        event.sender.send('task-add-reply', {
            object,
            code: code,
            message: i18n.t('task.saveFolderNoExist')
        });
        return;
    }

    if (/^file:\/\/\//g.test(m3u8_url)) {
        parser.push(fs.readFileSync(m3u8_url.replace(/^file:\/\/\//g, '')));
        parser.end();
    } else {
        for (let index = 0; index < 3; index++) {
            let response = await got(m3u8_url, {
                headers: _headers,
                timeout: httpTimeout,
                agent: proxy_agent
            }).catch(err => {
                err.message += `\n\ton electron.main('task-add': '${m3u8_url}')`;
                logger.error(err)
            });

            if (response && response.body != null && response.body != '') {
                parser.push(response.body);
                parser.end();

                if (parser.manifest.segments.length == 0 && parser.manifest.playlists && parser.manifest.playlists.length && parser.manifest.playlists.length == 1) {
                    let uri = parser.manifest.playlists[0].uri;
                    if (!uri.startsWith('http')) {
                        m3u8_url = uri[0] == '/' ? (m3u8_url.substr(0, m3u8_url.indexOf('/', 10)) + uri) :
                            (m3u8_url.replace(/\/[^\/]*((\?.*)|$)/, '/') + uri);
                    }
                    else {
                        m3u8_url = uri;
                    }
                    object.url = m3u8_url;
                    parser = new Parser();
                    continue;
                }
                break;
            }
        }
    }

    let count_seg = parser.manifest.segments.length;
    if (object.audio) count_seg++;
    if (count_seg > 0) {
        code = 0;
        if (parser.manifest.endList) {
            let duration = 0;
            parser.manifest.segments.forEach(segment => {
                duration += segment.duration;
            });
            info = i18n.t('task.parsingM3U8ok', { count_seg }) // 点播资源解析成功
            startDownload(object);
        } else {
            info = i18n.t('task.parsingLiveOk') // 直播资源解析成功
            startDownloadLive(object);
        }
    } else if (parser.manifest.playlists && parser.manifest.playlists.length && parser.manifest.playlists.length >= 1) {
        if (parser.manifest.mediaGroups && parser.manifest.mediaGroups.AUDIO && Object.keys(parser.manifest.mediaGroups.AUDIO).length > 0) {
            parser.manifest.playlists = parser.manifest.playlists.map((p, i) => ({
                ...p,
                ...{ audio: parser.manifest.mediaGroups.AUDIO[p.attributes.AUDIO].Audio.uri }
            }))
        }

        code = 1;
        event.sender.send('task-add-reply', {
            object,
            code: code,
            message: '',
            // playlists: parser.manifest.playlists
            playlists: parser.manifest.playlists.sort((a, b) => b.attributes.BANDWIDTH - a.attributes.BANDWIDTH)
        });
        return;
    }
    event.sender.send('task-add-reply', {
        object: { ...object, ...{ status: taskStatus.parsingFailed, statusText: info } },
        code: code,
        message: info
    });
});

ipcMain.on('task-add-muti', async function (event, object) {
    let m3u8_urls = object.m3u8_urls;
    let _headers = {};
    if (object.headers) {
        let __ = object.headers.match(/(.*?): ?(.*?)(\n|\r|$)/g);
        __ && __.forEach((_) => {
            let ___ = _.match(/(.*?): ?(.*?)(\n|\r|$)/i);
            ___ && (_headers[___[1]] = ___[2]);
        });
    }

    let info = i18n.t('task.parsingFailed') // 解析资源失败
    let code = -1;
    let iidx = 0;
    m3u8_urls.split(/\r|\n/g).forEach(urls => {
        if (urls != '') {
            let _obj = {
                url: '',
                headers: object.headers,
                myKeyIV: '',
                taskName: '',
                taskIsDelTs: object.taskIsDelTs,
                url_prefix: ''
            };
            if (/-{4}/.test(urls)) {
                let __ = urls.split('----');
                if (__ && __.length >= 2) {
                    if (__[0]) {
                        _obj.url = __[0];
                        if (__[1]) {
                            _obj.taskName = __[1];
                        }
                    }
                }
            } else {
                _obj.url = urls;
            }

            if (_obj.url) {

                let mes = _obj.url.match(/^https?:\/\/[^/]*/);
                let _hosts = '';
                if (mes && mes.length >= 1) {
                    _hosts = mes[0];

                    if (_headers['Origin'] == null && _headers['origin'] == null) {
                        _headers['Origin'] = _hosts;
                    }
                    if (_headers['Referer'] == null && _headers['referer'] == null) {
                        _headers['Referer'] = _hosts;
                    }
                }

                // _obj.headers = _headers;
                _obj.headers = { ...httpHeader, ..._headers };

                startDownload(_obj, iidx);
                iidx = iidx + 1;
            }
        }
    })
    info = i18n.t('task.multiAddOk') // 批量添加成功，正在下载
    event.sender.send('task-add-reply', {
        code: 0,
        message: info
    });
});

class QueueObject {
    constructor() {
        this.segment = null;
        this.url = '';
        this.url_prefix = '';
        this.headers = '';
        this.myKeyIV = '';
        this.id = 0;
        this.idx = 0;
        this.dir = '';
        this.then = this.catch = null;
    }
    async callback(_callback) {
        try {
            if (!taskRuntime.isActive(this.id)) {
                // logger.debug(`globalTaskStatusDic[${this.id}] is not exsited.`);
                return;
            }

            let segment = this.segment;
            let uri_ts = resolveMediaUri(this.url, this.url_prefix, segment.uri);
            if (!uri_ts) {
                taskRuntime.stop(this.id);
                this.catch && this.catch();
                return;
            }

            let filename = `${((this.idx + 1) + '').padStart(6, '0')}.ts`;
            let filpath = path.join(this.dir, filename);
            let filpath_dl = path.join(this.dir, filename + ".dl");

            // logger.debug(`==> ${uri_ts} => ${filename}`);
            // 检测文件是否存在。
            for (let index = 0; index < 3 && !fs.existsSync(filpath); index++) {

                let that = this;

                if (/^file:\/\/\//.test(uri_ts)) {
                    fs.copyFileSync(uri_ts.replace(/^file:\/\/\//, ''), filpath_dl);
                } else {

                    var _headers = [];
                    if (that.headers) {
                        for (var _key in that.headers) {
                            _headers.push(_key + ": " + that.headers[_key])
                        }
                    }
                    //aria2Client && aria2Client.call("addUri", [uri_ts], { dir:that.dir, out: filename + ".dl", split: "16", header: _headers});
                    //break;
                    const result = await downloadFileWithRetry(uri_ts, that.dir, {
                        filename: filename + ".dl",
                        timeout: httpTimeout,
                        headers: that.headers,
                        agent: proxy_agent
                    }, this.id, 10);
                    if (result.canceled) return;
                    if (!result.ok) break;
                }
                if (!fs.existsSync(filpath_dl)) continue;

                fs.statSync(filpath_dl).size <= 0 && safeUnlink(filpath_dl);

                if (segment.key != null && segment.key.method != null) {
                    // 标准 AES-128 解密 TS 流。
                    let aes_path = path.join(this.dir, "aes.key");
                    if (!this.myKeyIV && !fs.existsSync(aes_path)) {
                        let key_uri = resolveKeyUri(this.url, this.url_prefix, segment.key.uri);
                        if (!key_uri) {
                            taskRuntime.stop(this.id);
                            this.catch && this.catch();
                            return;
                        }

                        if (/^http/.test(key_uri)) {
                            const keyResult = await downloadFileWithRetry(key_uri, that.dir, {
                                filename: "aes.key",
                                headers: that.headers,
                                timeout: httpTimeout,
                                agent: proxy_agent
                            }, this.id, 10);
                            if (!keyResult.ok) {
                                taskRuntime.stop(this.id);
                                this.catch && this.catch();
                                return;
                            }
                        } else if (/^file:\/\/\//.test(key_uri)) {
                            key_uri = key_uri.replace('file:///', '')
                            if (fs.existsSync(key_uri)) {
                                fs.copyFileSync(key_uri, aes_path);
                            } else {
                                taskRuntime.stop(this.id);
                                this.catch && this.catch();
                                return;
                            }
                        }
                    }
                    if (this.myKeyIV || fs.existsSync(aes_path)) {
                        try {
                            let key_ = null;
                            let iv_ = null;
                            if (!this.myKeyIV) {
                                key_ = fs.readFileSync(aes_path);
                                if (key_.length == 32) {
                                    key_ = Buffer.from(fs.readFileSync(aes_path, {
                                        encoding: 'utf8'
                                    }), 'hex');
                                }
                                iv_ = segment.key.iv != null ? Buffer.from(segment.key.iv.buffer) :
                                    Buffer.from(that.idx.toString(16).padStart(32, '0'), 'hex');
                            } else {

                                key_ = Buffer.from(this.myKeyIV.substr(0, 32), 'hex');
                                if (this.myKeyIV.length >= 64) {
                                    iv_ = Buffer.from(this.myKeyIV.substr(this.myKeyIV.length - 32, 32), 'hex');
                                } else {
                                    iv_ = Buffer.from(that.idx.toString(16).padStart(32, '0'), 'hex')
                                }
                            }
                            // logger.debug(`key:${key_.toString('hex')} | iv:${iv_.toString('hex')}`)
                            let cipher = crypto.createDecipheriv((segment.key.method + "-cbc").toLowerCase(), key_, iv_);
                            cipher.on('error', console.error);
                            let inputData = fs.readFileSync(filpath_dl);
                            let outputData = Buffer.concat([cipher.update(inputData), cipher.final()]);
                            fs.writeFileSync(filpath, outputData);

                            if (fs.existsSync(filpath_dl))
                                safeUnlink(filpath_dl);

                            that.then && that.then();
                        } catch (error) {
                            logger.error(error)
                            if (fs.existsSync(filpath_dl))
                                safeUnlink(filpath_dl);
                        }
                        return;
                    }
                } else {
                    fs.renameSync(filpath_dl, filpath);
                    break;
                }
            }
            if (fs.existsSync(filpath)) {
                this.then && this.then();
            } else {
                this.catch && this.catch();
            }
        } catch (e) {
            logger.error(e);
        } finally {
            _callback();
        }
    }
}

function queue_callback(that, callback) {
    that.callback(callback);
}

function getDownloadConcurrency() {
    const value = Number.parseInt(nconf.get('downloadConcurrency') || nconf.get('config_downloadConcurrency') || 3);
    return Number.isFinite(value) && value > 0 ? value : 3;
}
async function startDownload(object, iidx) {
    let id = !object.id ? (iidx != null ? (new Date().getTime() + iidx) : new Date().getTime()) : object.id;
    let headers = object.headers;
    let url_prefix = object.url_prefix;
    let taskName = object.taskName;
    const taskTag = object.tag;
    let myKeyIV = object.myKeyIV;
    let url = object.url;
    let url_audio = object.audio;
    let taskIsDelTs = object.taskIsDelTs;
    if (!taskName) {
        taskName = `${id}`;
    }

    // let dir = path.join(pathDownloadDir, filenamify(taskName, { replacement: '_' }));
    let dir = getTaskDir(object.dir, taskName);

    logger.info(`Downloading ${id} ${url}`);
    logger.info(`Download to ${dir}`);

    !fs.existsSync(dir) && fs.mkdirSync(dir, { recursive: true });

    let parser = new Parser();
    if (/^file:\/\/\//g.test(url)) {
        parser.push(fs.readFileSync(url.replace(/^file:\/\/\//, ''), { encoding: 'utf-8' }));
        parser.end();
    } else {
        for (let index = 0; index < 3; index++) {
            let response = await got(url, {
                headers: headers,
                timeout: httpTimeout,
                agent: proxy_agent
            }).catch(logger.error); {
                if (response && response.body != null && response.body != '') {
                    parser.push(response.body);
                    parser.end();
                    if (parser.manifest.segments.length == 0 && parser.manifest.playlists && parser.manifest.playlists.length && parser.manifest.playlists.length >= 1) {
                        let uri = parser.manifest.playlists[0].uri;
                        if (!uri.startsWith('http')) {
                            url = uri[0] == '/' ? (url.substr(0, url.indexOf('/', 10)) + uri) :
                                (url.replace(/\/[^\/]*((\?.*)|$)/, '/') + uri);
                        }
                        else {
                            url = uri;
                        }
                        parser = new Parser();
                        continue;
                    }
                    break;
                }
            }
        }
    }

    if (url_audio) startDownloadAudio(object, iidx);

    // 启用下载队列。
    var tsQueues = async.queue(queue_callback, getDownloadConcurrency());

    let count_seg = parser.manifest.segments.length;
    let count_downloaded = 0;
    var video = {
        id: id,
        url_prefix: url_prefix,
        url: url,
        audio: url_audio,
        dir: dir,
        segment_total: count_seg,
        segment_downloaded: count_downloaded,
        time: dateFormat(new Date(), "yyyy-mm-dd HH:MM:ss"),
        status: taskStatus.initializing,// i18n.t('task.initializing'),// 初始化
        statusText: i18n.t('task.initializing'),// 初始化
        isLiving: false,
        headers: headers,
        taskName: taskName,
        tag: taskTag,
        myKeyIV: myKeyIV,
        taskIsDelTs: taskIsDelTs,
        success: true,
        videopath: ''
    };

    taskRuntime.start(id);
    let segments = parser.manifest.segments;
    if (segments[0].map && segments[0].map.uri) {
        // init.mp4 for HLS
        segments.unshift({
            uri: segments[0].map.uri
        })
        video.segment_total = segments.length;
    }

    if (!object.id) {
        mainWindow && mainWindow.webContents.send('task-notify-create', video);
    }

    if (!videoDatas.some(k => k.id == video.id)) {
        videoDatas.splice(0, 0, video);
        saveDBdisk()
    }

    for (let iSeg = 0; iSeg < segments.length; iSeg++) {
        let qo = new QueueObject();
        qo.dir = dir;
        qo.idx = iSeg;
        qo.id = id;
        qo.url = url;
        qo.url_prefix = url_prefix;
        qo.headers = headers;
        qo.myKeyIV = myKeyIV;
        qo.segment = segments[iSeg];
        qo.then = function () {
            count_downloaded = count_downloaded + 1
            video.segment_downloaded = count_downloaded;
            video.status = taskStatus.downloading;
            video.statusText = i18n.t('task.downloading', {
                count_downloaded, // 下载中
                count_seg,
                percent: percentFormat(count_downloaded, count_seg)
            });
            if (video.success) {
                mainWindow.webContents.send('task-notify-update', video);
            }
        };
        qo.catch = function () {
            taskRuntime.stop(id);
            video.success = false;

            logger.info(`URL:${video.url} | ${this.segment.uri} download failed`);
            video.status = taskStatus.failedMultipleTimes
            video.statusText = i18n.t('task.failedMultipleTimes')
            mainWindow.webContents.send('task-notify-end', video);

            saveDBdisk()
        }
        tsQueues.push(qo);
    }
    tsQueues.drain(async () => {
        if (!video.success) return;
        if (video.segment_downloaded != video.segment_total) return;

        logger.info(`Download vidoe ok! ${id}`);

        let fileSegments = [];
        for (let iSeg = 0; iSeg < segments.length; iSeg++) {
            let filpath = path.join(dir, `${((iSeg + 1) + '').padStart(6, '0')}.ts`);
            if (fs.existsSync(filpath)) {
                fileSegments.push(filpath);
            }
        }

        if (!fileSegments.length) {
            video.status = taskStatus.downloadFaild;
            video.statusText = i18n.t('task.downloadFaild'); // 下载失败，请检查链接有效性
            mainWindow.webContents.send('task-notify-end', video);
            logger.error(`[${url}] download failed, please check URL validity`);
            return;
        }
        let outPathMP4 = path.join(dir, Date.now() + ".mp4");
        let outNewPathMP4 = path.join(dir, '../', filenamify(taskName, { replacement: '_' }) + '.mp4');
        if (fs.existsSync(ffmpegPath)) {
            let ffmpegInputStream = new FFmpegStreamReadable(null);
            let ff = new ffmpeg(ffmpegInputStream)
                .setFfmpegPath(ffmpegPath)
                .videoCodec('copy')
                .audioCodec('copy')
                .format('mp4')
                .save(outPathMP4)
                .on('start', function (commandLine) {
                    logger.debug('merge cmd = ' + commandLine)
                })
                .on('error', (error) => {
                    logger.error(error)
                    video.videopath = "";
                    video.status = taskStatus.mergeFaild;
                    video.statusText = i18n.t('task.mergeFaild') // 合并出错，请尝试手动合并
                    mainWindow.webContents.send('task-notify-end', video);

                    saveDBdisk()
                })
                .on('end', async () => {
                    logger.info(`${outPathMP4} merge finished.`)
                    video.videopath = "";
                    if (fs.existsSync(outPathMP4)) {
                        if (video.audio) {
                            const files = fs.readdirSync(video.dir);
                            const m4a = files.find(file => path.extname(file).toLowerCase() === '.m4a');

                            if (m4a) {
                                const newMP4 = path.join(video.dir, Date.now() + ".mp4");

                                // let stream2 = new FFmpegStreamReadable(null);
                                // new ffmpeg(stream2)
                                new ffmpeg()
                                    // .setFfmpegPath(ffmpegPath)
                                    .input(outPathMP4)
                                    .input(path.join(video.dir, m4a))
                                    .outputOptions([
                                        '-c:v copy',     // copy video, not transcoding
                                        '-c:a copy',     // copy audio, not transcoding
                                        '-map 0:v:0',    // from 1st input(videoFile), select video
                                        '-map 1:a:0',    // from 2nd input(audioFile), select audio
                                    ])
                                    .format('mp4')
                                    .save(newMP4)
                                    .on('start', function (commandLine) {
                                        logger.debug('merge cmd (mp4 + m4a) = ' + commandLine)
                                    })
                                    .on('end', async () => {
                                        logger.info(`merge video & audio finished.`)

                                        try {
                                            await sleep(100);
                                            fs.renameSync(newMP4, outNewPathMP4);
                                        } catch (error) {
                                            error.message += `\n\ton After FFMPEG MergeDeleteExistedMP4`
                                            logger.error(error)
                                        }
                                        video.videopath = outNewPathMP4;

                                        if (video.taskIsDelTs) {
                                            safeRemoveDir(dir);
                                        }

                                        video.status = taskStatus.done; // 已完成
                                        video.statusText = i18n.t('task.done') // 已完成

                                        video.webContents = i18n.t('task.done')
                                        mainWindow.webContents.send('task-notify-end', video);

                                        saveDBdisk();
                                        await sleep(200);

                                    })
                                    .on('error', (err) => {
                                        console.error('merge (mp4 + m4a) error:', err.message);
                                    })
                            }
                        }
                        else {
                            try {
                                await sleep(200);
                                fs.renameSync(outPathMP4, outNewPathMP4);
                            } catch (error) {
                                error.message += `\n\ton After FFMPEG MergeDeleteExistedMP4`
                                logger.error(error)
                            }
                            video.videopath = outNewPathMP4;

                            if (video.taskIsDelTs) {
                                safeRemoveDir(dir);
                            }


                            video.status = taskStatus.done; // 已完成
                            video.statusText = i18n.t('task.done') // 已完成

                            video.webContents = i18n.t('task.done')
                            mainWindow.webContents.send('task-notify-end', video);

                            saveDBdisk();
                            await sleep(200);
                        }
                    }

                    // ff.kill();
                    // ff = null;
                })
                .on('progress', (info) => {
                    logger.info(JSON.stringify(info));
                });

            for (let i = 0; i < fileSegments.length; i++) {
                let percent = Number.parseInt((i + 1) * 100 / fileSegments.length);
                video.status = taskStatus.merging; // 合并中
                video.statusText = i18n.t('task.merging', { percent }) // 合并进度
                mainWindow.webContents.send('task-notify-end', video);
                let filePath = fileSegments[i];
                if (fs.existsSync(filePath)) await pushFileToReadable(ffmpegInputStream, filePath);
                while (ffmpegInputStream._readableState.length > 0) {
                    await sleep(100);
                }
                // console.log("push " + percent);
            }

            await sleep(200);
            setTimeout(async () => {
                video.statusText = await getVideoDuration(video.videopath)
                video.statusText += '\u3000\u3000\u3000\u3000';
                await sleep(100);
                video.statusText += await getVideoSize(video.videopath);

                mainWindow.webContents.send('task-notify-end', video);
                // console.log(`video.statusText = ${video.statusText}`)
                saveDBdisk();
            }, 1000);
            logger.debug("push(null) end");
            ffmpegInputStream.push(null);

        } else {
            video.videopath = outPathMP4;
            video.status = taskStatus.noFFMPEG;
            video.statusText = i18n.t('task.noFFMPEG') // 已完成，未发现本地 FFMPEG，不进行合成
            mainWindow.webContents.send('task-notify-end', video);
        }
    });
}

async function startDownloadAudio(object, iidx) {
    let id = object.id;
    let headers = object.headers;
    let url_prefix = object.url_prefix;
    let taskName = object.taskName;
    const taskTag = object.tag;
    let myKeyIV = object.myKeyIV;
    let url = object.audio;
    let taskIsDelTs = object.taskIsDelTs;
    if (!taskName) {
        taskName = `${id}`;
    }

    // let dir = path.join(pathDownloadDir, filenamify(taskName, { replacement: '_' }), 'aud');
    let dir = path.join(getTaskDir(object.dir, taskName), 'aud');

    logger.info(`Downloading audio ${id} ${url}`);
    logger.info(`Download to ${dir}`);

    !fs.existsSync(dir) && fs.mkdirSync(dir, { recursive: true });

    let parser = new Parser();

    //try to download aduio 3 times
    for (let index = 0; index < 3; index++) {
        let response = await got(url, {
            headers: headers,
            timeout: httpTimeout,
            agent: proxy_agent
        }).catch(logger.error); {
            if (response && response.body != null && response.body != '') {
                parser.push(response.body);
                parser.end();
                if (parser.manifest.segments.length == 0 && parser.manifest.playlists && parser.manifest.playlists.length && parser.manifest.playlists.length >= 1) {
                    let uri = parser.manifest.playlists[0].uri;
                    if (!uri.startsWith('http')) {
                        url = uri[0] == '/' ? (url.substr(0, url.indexOf('/', 10)) + uri) :
                            (url.replace(/\/[^\/]*((\?.*)|$)/, '/') + uri);
                    }
                    else {
                        url = uri;
                    }
                    parser = new Parser();
                    continue;
                }
                break;
            }
        }
    }

    // 启用音频下载队列。
    var tsQueues = async.queue(queue_callback, getDownloadConcurrency());

    let count_seg = parser.manifest.segments.length;
    let count_downloaded = 0;
    var audio = {
        id: id,
        url_prefix: url_prefix,
        url: url,
        audio: url,
        dir: dir,
        segment_total: count_seg,
        segment_downloaded: count_downloaded,
        time: dateFormat(new Date(), "yyyy-mm-dd HH:MM:ss"),
        status: taskStatus.initializing,// i18n.t('task.initializing'),// 初始化
        statusText: i18n.t('task.initializing'),// 初始化
        isLiving: false,
        headers: headers,
        taskName: taskName,
        tag: taskTag,
        myKeyIV: myKeyIV,
        taskIsDelTs: taskIsDelTs,
        success: true,
        videopath: ''
    };

    // taskRuntime.start(id);
    let segments = parser.manifest.segments;
    if (segments[0].map && segments[0].map.uri) {
        // init.mp4 for HLS
        segments.unshift({
            uri: segments[0].map.uri
        })
        audio.segment_total += 1;
    }

    for (let iSeg = 0; iSeg < segments.length; iSeg++) {
        let qo = new QueueObject();
        qo.dir = dir;
        qo.idx = iSeg;
        qo.id = id;
        qo.url = url;
        qo.url_prefix = url_prefix;
        qo.headers = headers;
        qo.myKeyIV = myKeyIV;
        qo.segment = segments[iSeg];
        qo.then = function () {
            count_downloaded = count_downloaded + 1
            audio.segment_downloaded = count_downloaded;
            // video.status = taskStatus.downloading;
            // video.statusText = i18n.t('task.downloading', {
            //     count_downloaded, // 下载中
            //     count_seg,
            //     percent: percentFormat(count_downloaded, count_seg)
            // });
            // if (audio.success) {
            //     mainWindow.webContents.send('task-notify-update', audio);
            // }
        };
        qo.catch = function () {
            logger.info(`Audio URL:${audio.url} | ${this.segment.uri} download failed`);
        }
        tsQueues.push(qo);
    }
    tsQueues.drain(async () => {
        if (!audio.success) return;
        if (audio.segment_downloaded != audio.segment_total) return;

        logger.info(`Download audio ok! ${id}`);

        let fileSegments = [];
        for (let iSeg = 0; iSeg < segments.length; iSeg++) {
            let filpath = path.join(dir, `${((iSeg + 1) + '').padStart(6, '0')}.ts`);
            if (fs.existsSync(filpath)) {
                fileSegments.push(filpath);
            }
        }

        if (!fileSegments.length) {
            // audio.status = taskStatus.downloadFaild;
            // audio.statusText = i18n.t('task.downloadFaild'); // 下载失败，请检查链接有效性
            // mainWindow.webContents.send('task-notify-end', audio);
            logger.error(`[${url}] audio download failed, please check URL validity`);
            return;
        }
        let outPathM4A = path.join(dir, '../', Date.now() + ".m4a");
        if (fs.existsSync(ffmpegPath)) {
            let ffmpegInputStream = new FFmpegStreamReadable(null);
            let ff = new ffmpeg(ffmpegInputStream)
                .setFfmpegPath(ffmpegPath)
                .videoCodec('copy')
                .audioCodec('copy')
                .format('mp4')
                .save(outPathM4A)
                .on('start', function (commandLine) {
                    logger.debug('merge m4a cmd = ' + commandLine)
                })
                .on('error', (error) => {
                    logger.error(error)
                    // audio.videopath = "";
                    // audio.status = taskStatus.mergeFaild;
                    // audio.statusText = i18n.t('task.mergeFaild') // 合并出错，请尝试手动合并
                    // mainWindow.webContents.send('task-notify-end', audio);

                    // saveDBdisk()
                })
                .on('end', async () => {
                    logger.info(`audio: ${outPathM4A} merge finished.`)
                    // if (fs.existsSync(outPathM4A)) {
                    //     try {
                    //         await sleep(200);
                    //         fs.renameSync(outPathM4A, outPathM4A_);
                    //     } catch (error) {
                    //         error.message += `\n\ton After FFMPEG MergeDeleteExistedM4A`
                    //         logger.error(error)
                    //     }
                    //     // audio.videopath = outPathM4A_;
                    // }
                    // audio.status = taskStatus.done; // 已完成
                    // audio.statusText = i18n.t('task.done') // 已完成

                    // audio.webContents = i18n.t('task.done')
                    // mainWindow.webContents.send('task-notify-end', audio);
                    if (audio.taskIsDelTs) {
                        safeRemoveDir(dir);
                    }

                    // saveDBdisk();
                    await sleep(200);
                    ff.kill();
                    ff = null;
                })
                .on('progress', (info) => {
                    logger.info(JSON.stringify(info));
                });

            for (let i = 0; i < fileSegments.length; i++) {
                let percent = Number.parseInt((i + 1) * 100 / fileSegments.length);
                // audio.status = taskStatus.merging; // 合并中
                // audio.statusText = i18n.t('task.merging', { percent }) // 合并进度
                // mainWindow.webContents.send('task-notify-end', audio);
                let filePath = fileSegments[i];
                if (fs.existsSync(filePath)) await pushFileToReadable(ffmpegInputStream, filePath);
                while (ffmpegInputStream._readableState.length > 0) {
                    await sleep(100);
                }
                // console.log("push " + percent);
            }

            await sleep(200);
            // setTimeout(async () => {
            //     audio.statusText = await getVideoDuration(audio.videopath)
            //     audio.statusText += '\u3000\u3000\u3000\u3000';
            //     await sleep(100);
            //     audio.statusText += await getVideoSize(audio.videopath);

            //     mainWindow.webContents.send('task-notify-end', audio);
            //     // console.log(`video.statusText = ${video.statusText}`)
            //     saveDBdisk();
            // }, 1000);
            logger.debug("audio push(null) end");
            ffmpegInputStream.push(null);

        } else {
            // audio.videopath = outPathM4A;
            // audio.status = taskStatus.noFFMPEG;
            // audio.statusText = i18n.t('task.noFFMPEG') // 已完成，未发现本地 FFMPEG，不进行合成
            // mainWindow.webContents.send('task-notify-end', audio);
        }
    });
}

function isFileOccupied(id, file_path) {
    try {
        if (!fs.existsSync(file_path)) {
        logger.debug(`${id}: 'File is NOT EXIST'`);
            return { code: false, msg: 'File is NOT EXIST' };
        }
        fs.accessSync(file_path, fs.constants.W_OK);
        logger.debug(`${id}: 'File is NOT occupied'`);
        return { code: false, msg: 'File is NOT occupied' };
    } catch (error) {
        logger.debug(`${id}: 'File is OCCUPIED'`);
        return { code: true, msg: 'File is OCCUPIED' };
    }
}

async function startDownloadLive(object) {
    let id = !object.id ? new Date().getTime() : object.id;
    let headers = object.headers;
    let taskName = object.taskName;
    const taskTag = object.tag;
    let myKeyIV = object.myKeyIV;
    let url = object.url;
    if (!taskName) {
        taskName = `${id}`;
    }
    // let dir = path.join(pathDownloadDir, filenamify(taskName, { replacement: '_' }));
    let dir = getTaskDir(object.dir, taskName);

    logger.info(`Download livestream to ${dir}`);

    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, {
            recursive: true
        });
    }

    let count_downloaded = 0;
    let count_seg = 100;
    var video = {
        id: id,
        url: url,
        dir: dir,
        segment_total: count_seg,
        segment_downloaded: count_downloaded,
        time: dateFormat(new Date(), "yyyy-mm-dd HH:MM:ss"),
        status: taskStatus.initializing,
        statusText: i18n.t('task.initializing'),// 初始化
        isLiving: true,
        myKeyIV: myKeyIV,
        taskName: taskName,
        tag: taskTag,
        headers: headers,
        videopath: ''
    };

    if (!videoDatas.some(k => k.id == video.id)) {
        videoDatas.splice(0, 0, video);
        saveDBdisk()
    }

    if (!object.id) {
        mainWindow.webContents.send('task-notify-create', video);
    }
    let segmentSet = new Set();
    let ffmpegInputStream = null;
    let ffmpegObj = null;
    taskRuntime.start(id);
    while (taskRuntime.isActive(id)) {
        try {
            const response = await got(url, {
                headers: headers,
                timeout: httpTimeout,
                agent: proxy_agent
            }).catch(logger.error);
            if (response == null || response.body == null || response.body == '') {
                break;
            }
            let parser = new Parser();
            parser.push(response.body);
            parser.end();

            let count_seg = parser.manifest.segments.length;
            let segments = parser.manifest.segments;
            // logger.info(`解析到 ${count_seg} 个片段`)

            if (count_seg > 0) {

                // 记录开始下载片段的时间，下载完成后需要计算下次请求的时间。
                let _startTime = new Date();
                let _videoDuration = 0;
                for (let iSeg = 0; iSeg < segments.length; iSeg++) {
                    let segment = segments[iSeg];
                    if (segmentSet.has(segment.uri)) {
                        continue;
                    }
                    if (!taskRuntime.isActive(id)) {
                        break;
                    }
                    _videoDuration = _videoDuration + segment.duration * 1000;
                    let uri_ts = resolveHttpUri(url, segment.uri);

                    let filename = `${((count_downloaded + 1) + '').padStart(6, '0')}.ts`;
                    let filpath = path.join(dir, filename);
                    let filpath_dl = path.join(dir, filename + ".dl");

                    for (let index = 0; index < 3; index++) {
                        if (!taskRuntime.isActive(id)) {
                            break;
                        }

                        //let tsStream = await got.get(uri_ts, {responseType:'buffer', timeout:httpTimeout ,headers:headers}).catch(logger.error).body();

                        const result = await downloadFileWithRetry(uri_ts, dir, {
                            filename: filename + ".dl",
                            timeout: httpTimeout,
                            headers: headers,
                            agent: proxy_agent
                        }, id, 10);
                        if (result.canceled) break;
                        if (!result.ok) continue;
                        if (fs.existsSync(filpath_dl)) {
                            let stat = fs.statSync(filpath_dl);
                            if (stat.size > 0) {
                                fs.renameSync(filpath_dl, filpath);
                            } else {
                                safeUnlink(filpath_dl);
                            }
                        }
                        if (fs.existsSync(filpath)) {
                            segmentSet.add(segment.uri);
                            if (ffmpegObj == null) {
                                let outPathMP4 = path.join(dir, id + '.mp4');
                                let newid = id;
                                // 不要覆盖之前下载的直播内容。
                                while (fs.existsSync(outPathMP4)) {
                                    outPathMP4 = path.join(dir, newid + '.mp4');
                                    newid = newid + 1;
                                }
                                if (fs.existsSync(ffmpegPath)) {
                                    ffmpegInputStream = new FFmpegStreamReadable(null);

                                    ffmpegObj = new ffmpeg(ffmpegInputStream)
                                        .setFfmpegPath(ffmpegPath)
                                        .videoCodec('copy')
                                        .audioCodec('copy')
                                        .save(outPathMP4)
                                        .on('error', logger.info)
                                        .on('end', function () {
                                            video.videopath = outPathMP4;
                                            video.status = taskStatus.done;
                                            video.statusText = i18n.t('task.done'); // 已完成
                                            mainWindow.webContents.send('task-notify-end', video);

                                            saveDBdisk()
                                        })
                                        .on('progress', logger.info);
                                } else {
                                    video.videopath = outPathMP4;
                                    video.status = taskStatus.noFFMPEG; // 已完成，未发现本地 FFMPEG，不进行合成
                                    video.statusText = i18n.t('task.noFFMPEG'); // 已完成，未发现本地 FFMPEG，不进行合成
                                    mainWindow.webContents.send('task-notify-update', video);
                                }
                            }

                            if (ffmpegInputStream) {
                                await pushFileToReadable(ffmpegInputStream, filpath);
                                safeUnlink(filpath);
                            }

                            //fs.appendFileSync(path.join(dir,'index.txt'),`file '${filpath}'\r\n`);
                            count_downloaded = count_downloaded + 1;
                            video.segment_downloaded = count_downloaded;
                            video.status = taskStatus.downloadLiveStreaming; // 下载直播中
                            video.statusText = i18n.t('task.downloadLiveStreaming', { count_downloaded }); // 下载直播中
                            mainWindow.webContents.send('task-notify-update', video);
                            break;
                        }
                    }
                }
                if (taskRuntime.isActive(id)) {

                    // 使下次下载 M3U8 时间提前 1 秒钟。
                    _videoDuration = _videoDuration - 1000;
                    let _downloadTime = (new Date().getTime() - _startTime.getTime());
                    if (_downloadTime < _videoDuration) {
                        await sleep(_videoDuration - _downloadTime);
                    }
                }
            } else {
                break;
            }
            parser = null;
        } catch (error) {
            logger.info(JSON.stringify(error.response.body));
        }
    }
    if (ffmpegInputStream) {
        ffmpegInputStream.push(null);
    }

    if (count_downloaded <= 0) {
        video.videopath = '';
        video.status = taskStatus.downloadButFaild; // 已完成，下载失败
        video.statusText = i18n.t('task.downloadButFaild'); // 已完成，下载失败
        mainWindow.webContents.send('task-notify-end', video);
        return;
    }
}

// function formatAsPercentage(num, total) {
//     return new Intl.NumberFormat('default', {
//         style: 'percent',
//         minimumFractionDigits: 0,
//         maximumFractionDigits: 2,
//     }).format(num / total);
// }

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function pushFileToReadable(readable, filePath) {
    return new Promise((resolve, reject) => {
        const stream = fs.createReadStream(filePath);
        stream.on('data', chunk => {
            if (!readable.push(chunk)) {
                stream.pause();
                const wait = setInterval(() => {
                    if (readable._readableState.length == 0) {
                        clearInterval(wait);
                        stream.resume();
                    }
                }, 50);
            }
        });
        stream.on('end', resolve);
        stream.on('error', reject);
    });
}
class FFmpegStreamReadable extends Readable {
    constructor(opt) {
        super(opt);
    }
    _read() { }
}

function formatTime(duration) {
    let sec = Math.floor(duration % 60).toLocaleString();
    let min = Math.floor(duration / 60 % 60).toLocaleString();
    let hour = Math.floor(duration / 3600 % 60).toLocaleString();
    if (sec.length != 2) sec = '0' + sec;
    if (min.length != 2) min = '0' + min;
    if (hour.length != 2) hour = '0' + hour;
    return hour + ":" + min + ":" + sec;
}

ipcMain.on('delvideo', async function (event, id, delfile = false) {
    // logger.debug(`${JSON.stringify(event)}, ${id}, ${delfile}`);
    // return;

    taskRuntime.stop(id);
    taskRuntime.remove(id);

    // logger.debug(`delete ===> ${id}, ${delfile}`);
    const idx = videoDatas?.findIndex(p => p.id == id);

    if (id == -1) return;
    let task = videoDatas[idx];
    const videopath = task.videopath;
    const dir = task.dir;

    try {
        if (delfile) {
            let cmd = 'rm -rf '
            if (os.type() == 'Windows_NT') {
                cmd = 'del /q '
            }
            try {
                // fs.unlinkSync(videopath);
                if (videopath && fs.existsSync(videopath)) {
                    cmd = `${cmd} "${videopath}"`;
                    //console.log(cmd)
                    const { stdout, stderr } = await exec(`${cmd} "${videopath}"`)
                }
            } catch (error) {
                console.error('delete video', error.message)
            }

            safeRemoveDir(dir);
        }

        videoDatas.splice(idx, 1);
        saveDBdisk();
        event.sender.send("delvideo-reply", task);
        task = null;
    } catch (error) {
        logger.error(error)
    }
});

function showDirInExploer(dir) {
    // logger.debug(`open folder: ${dir}`)
    fs.existsSync(dir) && shell.openPath(dir)
    return
    shell.openExternal(dir).catch((reason) => {
        logger.error(`openExternal Error:${dir} ${reason}`);

        let files = fs.readdirSync(dir);
        if (files && files.length > 0) {
            shell.showItemInFolder(path.join(dir, files[0]));
        } else {
            shell.showItemInFolder(dir);
        }
    });
}

ipcMain.on('opendir', function (event, arg, path2) {
    // logger.info(`opendir = ${arg}\t${path2}`);

    if (fs.existsSync(arg)) {
        showDirInExploer(arg);
    } else {
        let arr = arg.split(path.sep);
        let parent = arr.slice(0, arr.length - 1).join(path.sep);

        // logger.info(`打开父目录：${parent}`);
        if (fs.existsSync(parent))
            showDirInExploer(parent);
        else {
            fs.existsSync(path2) && showDirInExploer(path2)
        }
    }
    // fs.existsSync(arg) && showDirInExploer(arg);
    // !fs.existsSync(arg) && fs.existsSync(path2) && showDirInExploer(path2);

});

ipcMain.on('openInExplorer', function (event, file_path) {
    let explorer;
    if (!fs.existsSync(file_path))
        file_path = path.basename(path.dirname(file_path))
    if (!fs.existsSync(file_path))
        file_path = pathDownloadDir

    shell.showItemInFolder(file_path)
})

ipcMain.on('playvideo', function (event, videopath) {
    fs.existsSync(videopath) && createPlayerWindow(videopath);
});

ipcMain.on('player-pin-on-top', function (event, isTop) {
    nconf.set('alwaysOnTop', isTop)
    nconf.save()

    playerWindow?.setAlwaysOnTop(isTop)
    isTop && playerWindow?.show()

    mainWindow.webContents.send('set-player-top', isTop)
});

function toggleTaskRunning(arg) {
    let id = Number.parseInt(arg);
    if (!taskRuntime.has(id)) {
        if (videoDatas.some(k => k.id == id))
            taskRuntime.stop(id);
        else {
            logger.info('taskRuntime:' + JSON.stringify(taskRuntime.snapshot()) + ' NOT found id=' + arg)
            return;
        }
    }
    if (taskRuntime.isActive(id)) {
        taskRuntime.stop(id)
        logger.info('stop downloading, id=' + arg + ', isActive=' + taskRuntime.isActive(id));
    } else {
        taskRuntime.start(id)
        logger.info('restart downloading, id=' + arg + ', isActive=' + taskRuntime.isActive(id));

        videoDatas.forEach(Element => {
            if (Element.id == id) {
                if (Element.isLiving == true) {
                    startDownloadLive(Element);
                } else {
                    startDownload(Element);
                }
            }
        });
    }
}

ipcMain.on('task-toggle-running', function (event, arg) {
    toggleTaskRunning(arg);
});

ipcMain.on('StartOrStop', function (event, arg) {
    toggleTaskRunning(arg);
});
ipcMain.on('setting_isdelts', function (event, arg) {
    isdelts = arg;
});

ipcMain.on('set-config', function (event, data) {
    nconf.set(data.key, data.value);
    nconf.save();

    if (data.key == 'config_proxy') {
        const config_proxy = nconf.get('config_proxy');
        proxy_agent = config_proxy ? {
            http: new HttpProxyAgent({
                keepAlive: true,
                keepAliveMsecs: 1000,
                maxSockets: 256,
                maxFreeSockets: 256,
                scheduling: 'lifo',
                proxy: config_proxy
            }),
            https: new HttpsProxyAgent({
                keepAlive: true,
                keepAliveMsecs: 1000,
                maxSockets: 256,
                maxFreeSockets: 256,
                scheduling: 'lifo',
                proxy: config_proxy
            })
        } : null;
    } else if (data.key == 'language') {
        i18n.setLocale(data.value)
        updateContextMenu();
        // logger.debug(`${i18n.getLocale()} = ${i18n.t('message.hello')}`);
    }
})

ipcMain.on('open-directory', function (event, index, category) {
    // let SaveDir = pathDownloadDir;
    dialog.showOpenDialog(mainWindow, {
        title: i18n.t('dialog.title.saveFolder'),// "请选择文件夹",
        defaultPath: category ? (category.dir || '') : '',
        properties: ['openDirectory', 'createDirectory'],
    }).then(result => {
        if (!result.canceled && result.filePaths.length == 1) {
            // logger.debug(`选择目录 ${result.filePaths}`);
            pathDownloadDir = result.filePaths[0];
            // nconf.set('SaveVideoDir', pathDownloadDir);
            if (index == -1) {
                event.sender.send('open-directory-reply', index, pathDownloadDir);
                return;
            }

            let categories = nconf.get('categories');
            if (categories && categories.length > 0) {
                if (categories[index].dir != pathDownloadDir) {
                    category.dir = pathDownloadDir;
                    categories[index] = category;
                    nconf.set('categories', categories);
                    nconf.save();
                }
            } else {
                category.dir = pathDownloadDir;
                categories = [category];
                nconf.set('categories', categories);
                nconf.save();
            }

            event.sender.send('open-directory-reply', index, categories);
        }
    }).catch(err => {
        logger.error(`showOpenDialog ${err}`)
    });
});

ipcMain.on('open-select-m3u8', function (event, arg) {
    dialog.showOpenDialog(mainWindow, {
        title: i18n.t('dialog.title.selectM3U8'),// "请选择一个 M3U8 文件",
        properties: ['openFile'],
    }).then(result => {
        if (!result.canceled && result.filePaths.length == 1) {
            event.sender.send("open-select-m3u8-reply", `file:///${result.filePaths[0]}`);
        }
    }).catch(err => {
        logger.error(`showOpenDialog ${err}`)
    });
});

ipcMain.on('open-select-ts-dir', function (event, arg) {
    if (arg) {
        let files = [];
        try {
            files = fs.readdirSync(result.filePaths[0])
        } catch (error) {

        }
        if (files && files.length > 0) {
            let _files = files.filter((f) => {
                return f.endsWith('.ts') || f.endsWith('.TS')
            });
            if (_files.length) {
                event.sender.send("open-select-ts-select-reply", _files);
                return;
            }
        }
        return;
    }
    dialog.showOpenDialog(mainWindow, {
        title: i18n.t('dialog.title.mergeTS'),// "请选择欲合并的 TS 文件",
        // properties: ['openFile','openDirectory', 'multiSelections'],
        properties: ['openDirectory'],
        filters: [{
            name: 'TS Files',
            extensions: ['ts']
        }, {
            name: 'All Files',
            extensions: ['*']
        }]
    }).then(result => {
        if (!result.canceled && result.filePaths.length >= 1) {
            // logger.debug(JSON.stringify(result))

            if (result.filePaths.length == 1) {
                event.sender.send("open-select-ts-dir-reply", result.filePaths[0]);

                let files = [];
                try {
                    files = fs.readdirSync(result.filePaths[0])
                } catch (error) {

                }
                if (files && files.length > 0) {
                    let _files = files.filter((f) => {
                        return f.endsWith('.ts') || f.endsWith('.TS')
                    });
                    if (_files && _files.length) {
                        event.sender.send("open-select-ts-select-reply", _files);
                        return;
                    } else {
                        event.sender.send("open-select-ts-select-reply", files);
                        return;
                    }
                }
            }
            let _files = result.filePaths.filter((f) => {
                return f.endsWith('.ts') || f.endsWith('.TS')
            });
            if (_files && _files.length) {
                event.sender.send("open-select-ts-select-reply", _files);
            } else {
                event.sender.send("open-select-ts-select-reply", result.filePaths);
            }
        }
    }).catch(err => {
        logger.error(`showOpenDialog ${err}`)
    });
});

ipcMain.on('start-merge-ts', async function (event, task) {
    if (!task) return
    let temp_dir = (new Date().getTime() + '')
    let name = task.name || temp_dir

    // const filePath = path.join(pathDownloadDir, task.name + '.mp4')
    const filePath = path.join(task.ts_folder, '../', task.name + '.mp4')

    // let dir = path.join(pathDownloadDir, temp_dir);
    let dir = path.join(task.ts_folder, '../', temp_dir)
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, {
            recursive: true
        });
    }
    let outPathMP4 = path.join(dir, `${name}.mp4`);

    if (fs.existsSync(ffmpegPath)) {
        mainWindow.webContents.send('start-merge-ts-status', {
            code: 0,
            progress: 1,
            status: i18n.t('task.startMerge') // 开始合并
        });
        ffmpegInputStream = new FFmpegStreamReadable(null);

        new ffmpeg(ffmpegInputStream)
            .setFfmpegPath(ffmpegPath)
            .videoCodec(task.mergeType == 'speed' ? 'copy' : 'libx264')
            .audioCodec(task.mergeType == 'speed' ? 'copy' : 'aac')
            .format('mp4')
            .save(outPathMP4)
            .on('error', (error) => {
                logger.error(`Merge faild: ${task.ts_folder}\n\terror: ${error}`)
                mainWindow.webContents.send('start-merge-ts-status', {
                    code: -2,
                    progress: 100,
                    status: i18n.t('task.mergeFailedMsg', { error }) // 合并出错
                });
            })
            .on('end', async function () {
                mainWindow.webContents.send('start-merge-ts-status', {
                    code: 1,
                    progress: 100,
                    status: 'success',
                    dir: dir,
                    path: filePath,//outPathMP4
                });

                if (fs.existsSync(filePath)) safeUnlink(filePath);
                fs.renameSync(outPathMP4, filePath);
                safeRemoveDir(dir);

                videoDatas.filter(async (video) => {
                    if (video.dir == path.join(task.ts_folder, '../', task.name)) {
                        video.videopath = filePath
                        video.status = taskStatus.done;
                        try {
                            video.statusText = await getVideoDuration(filePath);
                            video.statusText += '\u3000\u3000\u3000\u3000';
                            video.statusText += await getVideoSize(filePath);
                        } catch (error) {
                            logger.error(error)
                        }

                        mainWindow.webContents.send('task-notify-end', video);
                        // console.log(`change statusText: ${JSON.stringify(video)}`)

                        saveDBdisk()
                    }
                })

                logger.info(`Merge finished:  ${task.ts_folder}\n\tto: ${filePath}`)
            })
            .on('progress', (info) => {
                // logger.info(JSON.stringify(info));
                // mainWindow.webContents.send('start-merge-ts-status', {
                //     code: 0,
                //     progress: -1,
                //     status: JSON.stringify(info)
                // });
            });

        let count = task.ts_files.length
        let list = task.ts_files.sort((a, b) => parseInt(a.replace(/.ts/ig, '') - parseInt(b.replace(/.ts/ig, ''))))

        for (let index = 0; index < count; index++) {
            // const file = task.ts_files[index];
            const file = list[index];
            await pushFileToReadable(ffmpegInputStream, path.join(task.ts_folder, file));
            while (ffmpegInputStream._readableState.length > 0) {
                await sleep(200);
            }
            let percent = Number.parseInt((index + 1) * 100 / count);
            mainWindow.webContents.send('start-merge-ts-status', {
                code: 0,
                progress: percent,
                status: i18n.t('task.merging', { percent }) // 合并进度
            });
        }
        ffmpegInputStream.push(null);
    } else {
        mainWindow.webContents.send('start-merge-ts-status', {
            code: -1,
            progress: 100,
            status: i18n.t('') // 未检测到 FFMPEG，不进行合并操作
        });
    }
});

ipcMain.on('check-update', async function (event, arg) {
    try {
        const newVersion = await checkUpdate()
        event.sender.send("check-update-reply", newVersion.replace('v', ''))
    } catch (error) {
        event.sender.send("check-update-reply", appInfo.version)
    }
});

ipcMain.on(`player-open-video`, async () => {
    if (!playerWindow) return;

    dialog.showOpenDialog(playerWindow, {
        title: i18n.t('dialog.title.selectVideo'),// "选择视频文件",
        properties: ['openFile'],
        filters: [{
            name: 'Video Files',
            extensions: ['mp4', 'avi', 'wmv', 'mpeg', 'mpg', 'mov',]
        }]
    }).then(result => {
        if (!result.canceled && result.filePaths.length >= 1) {
            // logger.debug(JSON.stringify(result))
            const src = result.filePaths[0];
            let title = src.split(path.sep);
            title = title[title.length - 1];

            if (result.filePaths.length == 1) {
                playerWindow.webContents.send('message', {
                    platform: process.platform, playsrc: src, title
                });
            }
        }
    }).catch(err => {
        logger.error(`[error]player-open-video:select-file:${err}`)
    });
});

ipcMain.on(`auto-manualMerge`, function (event, dir) {
    if (!fs.existsSync(dir)) return

    // logger.info(`auto-manualMerge:dir:${dir}`)
    event.sender.send("open-select-ts-dir-reply", dir);

    let name = dir.substr(dir.lastIndexOf('\\') + 1)

    fs.readdir(dir, (err, files) => {
        if (err)
            logger.error(`auto-manualMerge:read-dir: ${err}`);
        else {
            let tsFiles = files.filter((f) => {
                return f.endsWith('.ts') || f.endsWith('.TS')
            })

            event.sender.send("auto-manualMerge-reply", name, tsFiles);
            // logger.info(tsFiles[0])
        }
    })
})

function saveDBdisk() {
    // console.log('-------------------- save db --------------------')
    fs.writeFileSync(pathVideoDB, JSON.stringify(videoDatas));
}
