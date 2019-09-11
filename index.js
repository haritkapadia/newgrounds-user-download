/*
npm install --save selenium-webdriver request request-promise cheerio
*/

const https = require('https');
const url = require('url');
const fs = require('fs');
const request = require('request');
const requestPromise = require('request-promise');
const cheerio = require('cheerio');
const {Builder, By, Key, NoSuchElementError} = require('selenium-webdriver');
const chrome = require('selenium-webdriver/chrome');

const BASE_URL = 'https://deadlycomics.newgrounds.com';
const ALLOWED = ['art', 'movies'];


function download(link, filename, callback) {
    const file = fs.createWriteStream(filename);
    https.get(link, (res) => {
        res.pipe(file);
        file.on('finish', () => {
            file.close(callback);
        });
    }).on('error', (err) => {
        console.log('Error getting', filename, err);
    });
}

async function sleep(ms) {
    return new Promise((resolve) => {
        setTimeout(resolve, ms);
    });
}

async function getPortalLinks(driver, link, portalClass) {
    await driver.get(link);
    let lastHeight = 0;
    let pageHeight = await driver.executeScript("return document.body.scrollHeight");
    for(let i = 0; lastHeight !== pageHeight && i < 100; i++) {
        lastHeight = pageHeight;
        await driver.executeScript("window.scrollTo(0, document.body.scrollHeight);");
        await sleep(5000);
        pageHeight = await driver.executeScript("return document.body.scrollHeight");
    }
    const $ = cheerio.load(await driver.getPageSource());
    const portals = $(portalClass).children();
    const portalLinks = [];
    let linkPos = 0;
    for(let i = 0; i < portals[0].children.length; i++) {
        if(portals[0].children[i].type === 'tag' && portals[0].children[i].name === 'a') {
            linkPos = i;
            break;
        }
    }
    for(let i = 0; i < portals.length; i++) {
        if(portals[i].type === 'tag' && portals[i].name === 'div' && portals[i].children !== undefined) {
            portalLinks.push('https:' + portals[i].children[linkPos].attribs.href);
        }
    }
    return portalLinks;
}

function getURL(base, path) {
    return base + '/' + path.join('/');
}


(async () => {
    let driver = await new Builder()
        .forBrowser('chrome')
        // .setChromeOptions(new chrome.Options().addArguments(['--headless', '--windowsize=1920,1080']))
        .setChromeOptions(new chrome.Options().addArguments(['--no-proxy-server']))
        .build();
    try {
        // MOVIES
        if(ALLOWED.indexOf('movies') !== -1) {
            console.log('Downloading movies');
            const portalLinks = await getPortalLinks(driver, getURL(BASE_URL, ['movies']), 'div.portalsubmission-icons');
            console.log(portalLinks);
            //*
            for(let i = 0; i < portalLinks.length; i++) {
                await driver.get(portalLinks[i]);
                console.log(portalLinks[i]);
                try {
                    await driver.findElement(By.id('barrier_close_btn')).click();
                } catch(err) {
                    if(!(err.name === 'NoSuchElementError')) {
                        console.log(err);
                        process.exitCode = 1;
                    }
                }
                const $ = cheerio.load(await driver.getPageSource());
                requestPromise('https:' + $('#embed_sizer').children()[0].attribs.src).then((page) => {
                    const links = eval('[' + page.substring(page.indexOf('player.updateSrc') + 'player.updateSrc(['.length, page.indexOf(']', page.indexOf('player.updateSrc'))) + ']');
                    const linkpath = url.parse(links[links.length - 1].src).pathname.split('/');
                    download(links[links.length - 1].src, linkpath[linkpath.length - 1], () => {
                        console.log('wrote', linkpath[linkpath.length - 1]);
                    });
                }).catch((err) => {
                    console.log('Error on', portalLinks[i], err);
                });
            }
            //*/
        }


        // art
        if(ALLOWED.indexOf('art') !== -1) {
            console.log('Downloading art');
            const portalLinks = await getPortalLinks(driver, getURL(BASE_URL, ['art']), 'div.portalitem-art-icons');
            console.log(portalLinks, portalLinks.length);
            //*
            for(let i = 0; i < portalLinks.length; i++) {
                requestPromise(portalLinks[i]).then((res) => {
                    const $ = cheerio.load(res);
                    const ln = $('#portal_item_view').attr('href');
                    const linkPath = url.parse(ln).pathname.split('/');
                    download(ln, linkPath[linkPath.length - 1], () => {
                        console.log('wrote', linkPath[linkPath.length - 1]);
                    });
                }).catch((err) => {
                    console.log('Error on', portalLinks[i], err);
                });
            }
            //*/
        }



        // audio
        if(ALLOWED.indexOf('audio') !== -1) {
            console.log('Downloading audio');
            const portalLinks = await getPortalLinks(driver, getURL(BASE_URL, ['audio']), 'div.audio-wrapper');
            console.log(portalLinks, portalLinks.length);
            //*
            for(let i = 0; i < portalLinks.length; i++) {
                requestPromise((() => {
                    return portalLinks[i];
                })()).then((res) => {
                    const startIndex = res.indexOf('new embedController([{"url":') + 'new embedController([{"url":'.length;
                    const ln = eval(res.substring(startIndex, res.indexOf('"', startIndex + 1) + 1));
                    const linkPath = url.parse(ln).pathname.split('/');
                    download(ln, linkPath[linkPath.length - 1], () => {
                        console.log('wrote', linkPath[linkPath.length - 1]);
                    });
                }).catch((err) => {
                    console.log('Error on', portalLinks[i], err);
                });
            }
            //*/
        }
    } catch(err) {
        console.log(err);
    } finally {
        await driver.quit();
    }
})();
