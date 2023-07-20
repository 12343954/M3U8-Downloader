const { ipcRenderer } = require('electron');
const { shell } = require('electron');
// const { taskStatus, httpHeader, percentFormat } = require('./global-vars')

const i18n = new VueI18n({
    locale: 'en',
    messages: {
        en, 'zh-cn': zhCN
    }
});

const _app = new Vue({
    i18n,
    el: '#app',
    data: function () {
        return {
            taskStatus,
            version: '',
            newVersion: '',
            newVersion_download_url: 'https://github.com/12343954/M3U8-Downloader/releases',
            languages: [{ lang: 'English', value: 'en' }, { lang: '简体中文', value: 'zh-cn' }],
            m3u8_url: '',
            m3u8_urls: '',
            ts_dir: '',
            ts_folder: '',
            ts_urls: [],
            m3u8_url_prefix: '',
            dlg_header_visible: false,
            dlg_newtask_visible: false,
            dlg_deltask_visible: false,
            dlg_deltask_id: null,
            dlg_deltask_name: '',
            dlg_deltask_isDelFile: true,
            config_save_dir: '',
            config_ffmpeg: '',
            config_proxy: '',
            config_language: 'en',
            headers: '',
            myKeyIV: '',
            myLocalKeyIV: '',
            taskName: '',
            taskIsDelTs: true,
            allVideos: [],
            tabPane: '',
            tsMergeType: 'speed',
            tsMergeProgress: 0,
            tsMergeStatus: '',
            tsMergeMp4Path: '',
            tsMergeMp4Dir: '',
            tsTaskName: '',
            downloadSpeed: '0 MB/s',
            playlists: [],
            playlistUri: '',
            addTaskMessage: '',
            navigatorInput: '',
            //navigatorUrl:'about:blank',
            navigatorUrl: 'https://haokan.baidu.com/?sfrom=baidu-top',
            currentUserAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36 Edg/114.0.1823.41",
            browserVideoUrls: [],
            platform: '',
            dlg_buymecoffe_visible: false,
        }
    },
    methods: {
        clickNone: () => { console.log(`clickNone`) },
        installEvent: function (e) {
            let that = this;

            ipcRenderer.on('message', this.message.bind(this));

            ipcRenderer.on('open-select-m3u8-reply', function (event, data) {
                that.m3u8_url = data;
            });

            ipcRenderer.on('open-select-ts-dir-reply', function (event, data) {
                // console.log(data)
                that.ts_folder = data
                that.ts_dir = data;
                let sep = '/';
                if (data.split('\\').length > 1) sep = '\\'

                that.tsTaskName = data.substr(data.lastIndexOf(sep) + 1)
            });

            ipcRenderer.on('open-select-ts-select-reply', function (event, data) {
                that.ts_urls = data;
                // that.ts_dir = `选择了 [${that.ts_urls.length}] 个视频`;
                that.ts_dir = i18n.t('mergeTS.tips.select', { total: that.ts_urls.length })
                // console.log(data)
            });

            ipcRenderer.on('task-add-reply', function (event, data) {
                if (data.code != 1) {
                    that.dlg_newtask_visible = false;
                    that.taskName = '';
                    that.m3u8_url = '';
                    that.m3u8UrlChange();
                    that.notifyTaskStatus(data.code, data.message);
                    return;
                }
                that.playlists = data.playlists;
                that.playlistUri = that.playlists[0].uri;
                that.addTaskMessage = i18n.t('newTask.tips.addTaskMessage')// "请选择一种画质";
            });

            ipcRenderer.on('task-notify-create', function (event, data) {
                if (!that.allVideos.some(k => k.id == data.id)) {
                    that.allVideos.splice(0, 0, data);
                }
            });

            ipcRenderer.on('task-notify-update', function (event, data) {
                for (let idx = 0; idx < that.allVideos.length; idx++) {
                    let e = that.allVideos[idx];
                    if (e.id == data.id) {
                        Vue.set(that.allVideos, idx, data);
                        return;
                    }
                }
            });

            ipcRenderer.on('task-notify-end', function (event, data) {
                for (let idx = 0; idx < that.allVideos.length; idx++) {
                    let e = that.allVideos[idx];
                    if (e.id == data.id) {
                        Vue.set(that.allVideos, idx, data);
                        return;
                    }
                }
            });

            ipcRenderer.on('start-merge-ts-status', function (event, msg) {

                if (msg.progress != -1) that.tsMergeProgress = msg.progress;
                if (msg.status) that.tsMergeStatus = msg.status;
                if (msg.code == 1) {
                    that.tsMergeMp4Dir = msg.dir;
                    that.tsMergeMp4Path = msg.path;
                }
            });

            ipcRenderer.on('delvideo-reply', function (event, data) {
                for (let idx = 0; idx < that.allVideos.length; idx++) {
                    let e = that.allVideos[idx];
                    if (e.id == data.id) {
                        that.allVideos.splice(idx, 1);
                        return;
                    }
                }
            });

            ipcRenderer.on('check-update-reply', function (event, data) {
                that.newVersion = data
            })

            let browser = document.querySelector('#browser');
            browser?.addEventListener('new-window', (e) => {
                const protocol = (new URL(e.url)).protocol
                if (protocol === 'http:' || protocol === 'https:') {
                    browser?.loadURL(e.url)
                }
            });
            let navigateEvent = (e) => {
                that.navigatorInput = e.url;
                that.browserVideoUrls = [];
            }
            browser?.addEventListener('will-navigate', navigateEvent);
            browser?.addEventListener('did-navigate', navigateEvent);
            browser?.addEventListener('dom-ready', () => {
                browser?.openDevTools();
            });
        },
        message: function (_, { version, downloadSpeed,
            config_ffmpeg, config_save_dir, config_proxy, config_language, videoDatas, browserVideoItem, platform }) {
            if (version) {
                this.version = version
                this.newVersion = version
            }
            downloadSpeed && (this.downloadSpeed = downloadSpeed);
            config_ffmpeg && (this.config_ffmpeg = config_ffmpeg);
            config_save_dir && (this.config_save_dir = config_save_dir);
            config_proxy && (this.config_proxy = config_proxy);
            if (config_language) {
                this.config_language = config_language;
                i18n.locale = config_language;
            }
            videoDatas && (this.allVideos = videoDatas);
            browserVideoItem && (this.browserVideoUrls.push(browserVideoItem))
            platform && (this.platform = platform);
        },
        clickNaviagte: function (e) {
            if (!this.navigatorInput) return;
            !/^http[s]\:\/\//.test(this.navigatorInput) && (this.navigatorInput = 'http://' + this.navigatorInput);
            this.navigatorUrl != this.navigatorInput && (this.navigatorUrl = this.navigatorInput);
        },
        clickAClick: function (e) {
            e.preventDefault();
            console.log(e.target.href);
            shell.openExternal(e.target.href);
        },
        clickStartHookUrl: function (e) {
            ipcRenderer.send('new-hook-url-window');
        },
        clickMinWindow: e => {
            ipcRenderer.send('window-minimize');
        },
        clickMaxWindow: e => {
            ipcRenderer.send('window-toggle-maximize');
        },
        clickClose: function (e) {
            ipcRenderer.send('hide-windows');
        },
        clickSwitchLang: function (e) {
            // console.log(this.config_language)
            i18n.locale = this.config_language;
        },
        clickNewTask: function (e) {
            if (!this.config_save_dir) {
                this.tabPane = "setting";
                // this.$message({ title: '提示', type: 'error', message: "请先设置存储路径，再开始下载视频", offset: 100, duration: 1000 });
                this.$message({ title: i18n.t('message.title'), type: 'error', message: i18n.t('message.noSaveDir'), offset: 100, duration: 1000 });
                return;
            }
            this.dlg_newtask_visible = true;
            this.taskName = '';
            this.m3u8_url = '';

            navigator.clipboard.readText().then(
                clipText => {
                    //https://xxx.com/m3u8/824388.m3u8 filmname
                    if (!clipText) return;

                    if (/http(s):\/\/(.*)\.m3u8/ig.test(clipText)) {
                        setTimeout(() => {
                            this.m3u8_url = clipText;
                            this.m3u8UrlChange();
                            // console.log('clipboard', clipText)
                        }, 200);
                    }
                }
            );
        },
        clickNewTaskOK: function (e) {
            if (this.m3u8_url != '') {
                let m3u8_url = this.m3u8_url;
                if (this.playlistUri != '') {
                    const uri = this.playlistUri;
                    if (!uri.startsWith('http')) {
                        m3u8_url = uri[0] == '/' ? (m3u8_url.substr(0, m3u8_url.indexOf('/', 10)) + uri) :
                            (m3u8_url.replace(/\/[^\/]*((\?.*)|$)/, '/') + uri);
                    }
                    else {
                        m3u8_url = uri;
                    }
                }

                ipcRenderer.send('task-add', {
                    url: m3u8_url,
                    headers: this.headers,
                    myKeyIV: this.myKeyIV,
                    taskName: this.taskName,
                    taskIsDelTs: this.taskIsDelTs,
                    url_prefix: this.m3u8_url_prefix
                });

                this.addTaskMessage = i18n.t('message.title');// "正在检查链接..."
            }
            else {
                // this.$message({ title: '提示', type: 'error', message: "请输入正确的M3U8-URL或者导入(.m3u8)文件", offset: 100, duration: 1000 });
                this.$message({ title: i18n.t('message.title'), type: 'error', message: i18n.t('message.m3u8UrlError'), offset: 100, duration: 1000 });
            }
        },
        clickClearTask: function (e) {
            ipcRenderer.send('task-clear');
            // this.allVideos = this.allVideos.filter(k => k.status != '已完成') || [];
            this.allVideos = this.allVideos.filter(k => k.status != taskStatus.done) || [];
        },
        clickNewTaskMuti: function (e) {
            if (!this.config_save_dir) {
                this.tabPane = "setting";
                // this.$message({ title: '提示', type: 'error', message: "请先设置存储路径，再开始下载视频", offset: 100, duration: 1000 });
                this.$message({ title: i18n.t('message.title'), type: 'error', message: i18n.t('message.noSaveDir'), offset: 100, duration: 1000 });
                return;
            }
            if (this.m3u8_urls != '') {
                ipcRenderer.send('task-add-muti', {
                    m3u8_urls: this.m3u8_urls,
                    headers: this.headers,
                    taskIsDelTs: this.taskIsDelTs,
                    myKeyIV: '',
                    taskName: ''
                });
                this.dlg_newtask_visible = false;
                this.taskName = '';
            }
            else {
                // this.$message({ title: '提示', type: 'error', message: "请输入正确的M3U8-URL", offset: 100, duration: 1000 });
                this.$message({ title: i18n.t('message.title'), type: 'error', message: i18n.t('message.m3u8UrlError'), offset: 100, duration: 1000 });
            }
        },
        clickDelTaskOK: function (e) {
            // console.log('delvideo', this.dlg_deltask_id, this.dlg_deltask_isDelFile)
            ipcRenderer.send('delvideo', this.dlg_deltask_id, this.dlg_deltask_isDelFile);

            this.dlg_deltask_visible = false;
            this.dlg_deltask_id = null;
            this.dlg_deltask_name = null;
            this.dlg_deltask_isDelFile = true;
        },
        clickDelTaskCancel: function (e) {
            this.dlg_deltask_visible = false;
            this.dlg_deltask_id = null;
            this.dlg_deltask_name = null;
            this.dlg_deltask_isDelFile = true;
        },
        clickOpenConfigDir: function (e) {
            ipcRenderer.send("open-config-dir");
        },
        clickItemOptData: function (e) {
            let that = e.target;
            if (!that.hasAttribute('opt')) that = that.parentElement;

            var opt = that.getAttribute('opt');
            let data = that.getAttribute('data')

            if (opt == "StartOrStop") {
                // that.title = that.title == "停止" ? "继续下载" : "停止";
                this.allVideos.forEach(k => {
                    if (k.id == data) {
                        // if (k.status.startsWith('下载中'))
                        //     k.status = k.status.replace('下载中', '暂停')
                        // else
                        //     k.status = k.status.replace('暂停', '下载中')
                        if (k.status == taskStatus.downloading || k.status == taskStatus.downloadLiveStreaming || k.status == taskStatus.downloadMerging) {
                            k.status = taskStatus.pause;
                            k.statusText = i18n.t('taskStatus.pause', { count_downloaded: k.segment_downloaded, count_seg: k.segment_total, percent: percentFormat(k.segment_downloaded, k.segment_total) })
                        }
                        else if (k.status == taskStatus.pause) {
                            if (k.segment_total == k.segment_downloaded) {
                                k.status = taskStatus.startMerge
                                k.statusText = i18n.t('taskStatus.startMerge')
                            } else {
                                k.status = taskStatus.downloading;
                                k.statusText = i18n.t('taskStatus.downloading', { count_downloaded: k.segment_downloaded, count_seg: k.segment_total, percent: percentFormat(k.segment_downloaded, k.segment_total) })
                            }
                        }
                        return
                    }
                })
            }
            else if (opt == 'delvideo') { //&& video.status == '已完成'
                let video = this.allVideos.find(p => p.id == data);
                this.dlg_deltask_visible = true;
                this.dlg_deltask_id = data;
                this.dlg_deltask_name = video.taskName;
                this.dlg_deltask_isDelFile = true;
                // console.log(video);
                return;
            }

            ipcRenderer.send(opt, data);
        },
        clickPlayVideo: function (e) {
            let id = Number(e.target.getAttribute('data'))
            const video = this.allVideos.find(p => p.id == id)
            if (video) {
                if (video.status == taskStatus.done) {
                    ipcRenderer.send("playvideo", video.videopath);
                } else {
                    ipcRenderer.send("opendir", video.dir);
                }
            }
        },
        getPlaylistLabel: function (playlist) {
            if (!playlist || !playlist.attributes) return '';
            const attr = playlist.attributes;
            if (attr.BANDWIDTH) {
                // return `码率 - ${attr.BANDWIDTH}`;
                return `${i18n.t('unit.bitrate')} - ${attr.BANDWIDTH}`;
            }
            if (attr.bandwidth) {
                // return `码率 - ${attr.bandwidth}`;
                return `${i18n.t('unit.bitrate')} - ${attr.bandwidth}`;
            }
            if (attr.RESOLUTION) {
                // return `分辨率 - ${attr.RESOLUTION.width}x${attr.RESOLUTION.height}`;
                return `${i18n.t('unit.resolution')} - ${attr.RESOLUTION.width}x${attr.RESOLUTION.height}`;
            }
            if (attr.resolution) {
                // return `分辨率 - ${attr.resolution.width}x${attr.resolution.height}`;
                return `${i18n.t('unit.resolution')} - ${attr.resolution.width}x${attr.resolution.height}`;
            }
            // return '链接 - ' + playlist.uri;
            return `${i18n.t('unit.link')} - ${playlist.uri}`;
        },
        proxyChange: function () {
            ipcRenderer.send('set-config', { key: 'config_proxy', value: this.config_proxy });
        },
        languageChange: function () {
            i18n.locale = this.config_language;
            ipcRenderer.send('set-config', { key: 'language', value: this.config_language });
        },
        m3u8UrlChange: function () {
            let args = this.m3u8_url.split(/\s/g);
            const i = args.findIndex(p => /http(|s):\/\//i.test(p))
            if (i != -1) {
                this.m3u8_url = args[i]
                args.splice(i, 1)
                this.taskName = args.join(' ')
            }

            // if (args.length > 1) {
            //     args.forEach(k => {
            //         if (/http(|s):\/\//.test(k)) {
            //             this.m3u8_url = k;
            //         } else if (k.length > 1 && !/\s/.test(k)) {
            //             this.taskName = k;
            //         }
            //     })
            // }
            this.playlists = [];
            this.playlistUri = '';
            this.addTaskMessage = i18n.t('message.enterM3U8');//"请输入M3U8视频源";
        },
        notifyTaskStatus: function (code, message) {
            this.$notify({ title: i18n.t('message.title'), type: (code == 0 ? 'success' : 'error'), message: message, showClose: true, duration: 3000, position: 'bottom-right' });
        },
        clickOpenLogDir: function (e) {
            ipcRenderer.send('open-log-dir');
        },
        clickSelectM3U8: function (e) {
            ipcRenderer.send('open-select-m3u8');
        },
        clickSelectTSDir: function (e) {
            ipcRenderer.send('open-select-ts-dir');
        },
        clickStartMergeTS: function (e) {
            this.tsMergeMp4Dir = '';
            this.tsMergeMp4Path = '';
            this.tsMergeProgress = 0;
            this.tsMergeStatus = '';
            if (!this.config_save_dir) {
                this.tabPane = "setting";
                // this.$message({ title: '提示', type: 'error', message: "请先设置存储路径，再开始下载视频", offset: 100, duration: 1000 });
                this.$message({ title: i18n.t('message.title'), type: 'error', message: i18n.t('message.noSaveDir'), offset: 100, duration: 1000 });
                return;
            }

            // console.log('start merge', this.ts_folder, this.ts_urls.length, this.tsMergeType, this.tsTaskName)
            ipcRenderer.send('start-merge-ts', {
                ts_folder: this.ts_folder,
                ts_files: this.ts_urls,
                mergeType: this.tsMergeType,
                name: this.tsTaskName,
            });
        },
        clickClearMergeTS: function (e) {
            this.ts_dir = '';
            this.ts_urls = [];
            this.tsTaskName = '';
            this.tsMergeMp4Dir = '';
            this.tsMergeMp4Path = '';
            this.tsMergeProgress = 0;
            this.tsMergeStatus = '';
        },
        clickOpenMergeTSDir: function (e) {
            ipcRenderer.send('opendir', this.tsMergeMp4Dir, this.tsMergeMp4Path);
        },
        clickPlayMergeMp4: function (e) {
            ipcRenderer.send('playvideo', this.tsMergeMp4Path);
        },
        dropM3U8File: function (e) {
            e.preventDefault();

            if (!e.dataTransfer ||
                !e.dataTransfer.files ||
                e.dataTransfer.files.length == 0) {
                return;
            }
            let p = e.dataTransfer.files[0].path;
            this.m3u8_url = `file:///${p}`;
        },
        dropTSFiles: function (e) {
            e.preventDefault();

            if (!e.dataTransfer ||
                !e.dataTransfer.files ||
                e.dataTransfer.files.length == 0) {
                return;
            }
            let _filePath = [];
            for (let index = 0; index < e.dataTransfer.files.length; index++) {
                const f = e.dataTransfer.files[index];
                if (f.path.endsWith('.ts') || f.path.endsWith('.TS')) {
                    _filePath.push(f.path);
                }
            }
            if (_filePath.length) {
                this.ts_urls = _filePath;
                this.ts_dir = i18n.t('mergeTS.tips.select', { total: _filePath.length });// `选择了 [${_filePath.length}] 个视频`;

            } else if (e.dataTransfer.files.length == 1) {
                this.ts_dir = e.dataTransfer.files[0].path;
                ipcRenderer.send('open-select-ts-dir', e.dataTransfer.files[0].path);
            }
        },
        clickRefreshComment: function (e) {
            var GUEST_INFO = ['nick', 'mail', 'link'];
            var guest_info = 'nick'.split(',').filter(function (item) {
                return GUEST_INFO.indexOf(item) > -1
            });
            console.log(guest_info)
            var notify = 'false' == true;
            var verify = 'false' == true;
            new Valine({
                el: '.vcomment',
                notify: notify,
                verify: verify,
                appId: "dYhmAWg45dtYACWfTUVR2msp-gzGzoHsz",
                appKey: "SbuBYWY21MPOSVUCTHdVlXnx",
                placeholder: "可以在这里进行咨询交流",
                pageSize: '100',
                avatar: 'mm',
                lang: 'zh-cn',
                meta: guest_info,
                recordIP: true,
                path: '/m3u8-downloader'
            });
        },
        clickOpenGithub: function (e) {
            const url = 'https://github.com/12343954/M3U8-Downloader'
            url && shell.openExternal(url)
        },
        clickOpenSponsor: function (e) {
            this.dlg_buymecoffe_visible = true
        },
        checkUpdate: (oldVersion) => {
            ipcRenderer.send('check-update')
            return
            let that = this
            function str2float(v) {
                // version convert
                // 9999.9999.9999 > 1.1.1 最高支持4位版本对比。  1.2.1 > 1.2.0   1.3 > 1.2.9999
                v = `${v}`.replace('v', '')
                let va = v.split('.', 4);
                if (!va) return -1;
                let _r = 0;
                let base = 100000000.0;
                va.forEach(k => _r += (base * k), base /= 10000);
                console.log(`v=`, _r)
                return _r;
            }
            try {
                // fetch(`https://api.github.com/repos/12343954/M3U8-Downloader/releases/latest`)
                fetch(`https://api.github.com/repos/12343954/CpuGpuTemper/releases/latest`)
                    .then(response => response.json())
                    .then(json => {
                        that.newVersion = 'v2.2.3'
                        // console.log(json)
                        if (!json) return
                        if (json.message == "Not Found") {
                            console.log('update not found, return back')
                            return
                        }

                        console.log('new update found, please update')

                        if (str2float(json.tag_name) == str2float(oldVersion)) return
                        this.$set('newVersion', json.tag_name)
                        // that.newVersion = json.tag_name
                        // that.newVersion_download_url = `https://github.com/12343954/M3U8-Downloader/releases`

                        console.log(`newVersion =`, that.newVersion)

                    })
                    .catch(error => {
                        // console.error('Error:', error);
                    });
            } catch (error) {
                // that.newVersion = '2.2.3'
            }
        },
        clickUpdateApp: () => {
            shell.openExternal(this.newVersion_download_url)
        },
    },
    mounted: function () {
        let that = this
        that.installEvent();
        setTimeout(() => {
            that.checkUpdate(that.version)
        }, 5000);
    }
}).$mount('#app');