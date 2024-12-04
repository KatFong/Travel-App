#!/usr/bin/env node
const request = require('request-promise');

async function testProxy() {
    try {
        const data = await request({
            url: 'https://geo.brdtest.com/welcome.txt?product=dc&method=native',
            proxy: 'http://brd-customer-hl_a131286d-zone-datacenter_proxy1-country-us:t55krpy9mgbr@brd.superproxy.io:33335'
        });
        console.log('代理測試成功:', data);
    } catch (err) {
        console.error('代理測試失敗:', err);
    }
}

testProxy(); 