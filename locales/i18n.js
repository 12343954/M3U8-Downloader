const path = require('path');
const fs = require('fs');
const { app } = require('electron');

// 根据系统语言加载对应的 {lang}.json 文件
function getLocaleMessages(lang) {
    const targetFile = app.isPackaged
        ? path.join(process.resourcesPath, 'locales', `${lang}.json`)
        : path.join(__dirname, `${lang}.json`);

    return JSON.parse(fs.readFileSync(targetFile, 'utf-8'));
}

function getDescendantProp(obj, desc) {
    var arr = desc.split('.');
    while (arr.length) {
        obj = obj[arr.shift()];
    }
    return obj;
}

// var obj = { a: { b: { c: 0 } } };
// var propPath = getPropPath(); // 例如返回 "a.b.c"
// var result = getDescendantProp(obj, propPath);

// function I18n() {
let lang = 'en'
let messages = {}

function setLocale(locale) {
    messages = getLocaleMessages(locale)
    lang = locale
}
function getLocale() {
    return lang
}

function t(key, params) {
    if (key.indexOf('.') == -1) {
        if (params) {
            switch (typeof params) {
                case 'object':
                    if (Array.isArray(params)) {
                        //array
                        return messages[key].replace(/\{[^\}]+\}/g, JSON.stringify(params))
                    } else {
                        let msg = messages[key]
                        Object.keys(params).forEach(p => {
                            const reg = new RegExp(`\{${p}\}`, 'ig')
                            msg = msg.replace(reg, params[p])
                        })
                        return msg
                    }
                    break;
                case 'string':
                case 'number':
                case 'boolean':
                case 'bigint':
                    return messages[key].replace(/\{[^\}]+\}/g, JSON.stringify(params))
                default: //function,symbol,undefined
                    return '';
            }
        }
        else { return messages[key] }
    } else {
        if (params) {
            let msg = getDescendantProp(messages, key)
            Object.keys(params).forEach(p => {
                const reg = new RegExp(`\{${p}\}`, 'ig')
                msg = msg.replace(reg, params[p])
            })
            return msg
        } else {
            return getDescendantProp(messages, key)
        }

    }
}

// }

module.exports = { setLocale, getLocale, t }

