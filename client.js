document.addEventListener('DOMContentLoaded', () => {
    const searchButton = document.getElementById('searchButton');
    const backButton = document.getElementById('backButton');
    const searchContainer = document.querySelector('.search-container');
    const resultPage = document.getElementById('resultPage');
    const destinationInput = document.getElementById('destination');
    const durationInput = document.getElementById('duration');
    const chatBox = document.getElementById('chatBox');
    const minimizeChat = document.getElementById('minimizeChat');
    const chatMessages = document.getElementById('chatMessages');
    const chatInput = document.getElementById('chatInput');
    const sendChat = document.getElementById('sendChat');
    const startDateInput = document.getElementById('startDate');

    let currentItinerary = '';

    minimizeChat.addEventListener('click', (e) => {
        e.stopPropagation();
        chatBox.classList.toggle('minimized');
    });

    chatBox.querySelector('.chat-header').addEventListener('click', () => {
        chatBox.classList.remove('minimized');
    });

    function showError(message, details, errorObj = null) {
        const overlay = document.getElementById('overlay');
        overlay.classList.add('visible');

        const errorDetails = errorObj ? `
            錯誤類型: ${errorObj.name || '未知'}
            錯誤信息: ${errorObj.message || '無'}
            錯誤堆棧: ${errorObj.stack || '無'}
            響應狀態: ${errorObj.status || '無'}
            響應數據: ${JSON.stringify(errorObj.response || {}, null, 2)}
        ` : details;

        const errorDiv = document.createElement('div');
        errorDiv.className = 'error-popup';
        errorDiv.innerHTML = `
            <div class="error-message">
                <p>${message}</p>
                <p class="error-details">${details}</p>
                <pre class="error-technical-details">${errorDetails}</pre>
                <button class="copy-error">複製錯誤信息</button>
            </div>
            <div class="error-actions">
                <button id="retryButton" class="retry-button">重新生成</button>
            </div>
        `;

        document.body.appendChild(errorDiv);

        const copyButton = errorDiv.querySelector('.copy-error');
        copyButton.addEventListener('click', () => {
            const errorText = `
錯誤信息：${message}
詳細信息：${details}
技術詳情：${errorDetails}
時間：${new Date().toISOString()}
用戶代理：${navigator.userAgent}
            `.trim();

            navigator.clipboard.writeText(errorText).then(() => {
                copyButton.textContent = '已複製';
                setTimeout(() => {
                    copyButton.textContent = '複製錯誤信息';
                }, 2000);
            }).catch(err => {
                console.error('複製失敗:', err);
                copyButton.textContent = '複製失敗';
            });
        });

        const retryButton = errorDiv.querySelector('#retryButton');
        retryButton.addEventListener('click', () => {
            overlay.classList.remove('visible');
            errorDiv.remove();
            handleSearch();
        });

        overlay.addEventListener('click', () => {
            overlay.classList.remove('visible');
            errorDiv.remove();
        });
    }

    async function handleChatMessage(message) {
        const userDiv = document.createElement('div');
        userDiv.className = 'chat-message user';
        userDiv.textContent = message;
        chatMessages.appendChild(userDiv);
        chatMessages.scrollTop = chatMessages.scrollHeight;

        try {
            const prompt = `基下現有行程：
${currentItinerary}

用戶要求調整：
${message}

請按照相同的表格格式提供調整後的完整行程。`;

            const response = await generateItinerary(destinationInput.value, parseInt(durationInput.value), prompt);
            currentItinerary = response;

            const aiDiv = document.createElement('div');
            aiDiv.className = 'chat-message ai';
            aiDiv.textContent = '已更新行程';
            chatMessages.appendChild(aiDiv);
            chatMessages.scrollTop = chatMessages.scrollHeight;

            await displayResult(destinationInput.value, parseInt(durationInput.value), response);
        } catch (error) {
            console.error('調整行程錯誤:', error);
            showError('調整行程時發生錯誤', error.message);
        }
    }

    sendChat.addEventListener('click', () => {
        const message = chatInput.value.trim();
        if (message) {
            handleChatMessage(message);
            chatInput.value = '';
        }
    });

    chatInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendChat.click();
        }
    });

    function showSearchPage() {
        searchContainer.style.display = 'flex';
        resultPage.classList.add('hidden');
    }

    function showResultPage() {
        searchContainer.style.display = 'none';
        resultPage.classList.remove('hidden');
    }

    async function generateItinerary(destination, duration, startDate) {
        const baseUrl = window.location.hostname === 'localhost' 
            ? 'http://localhost:3000' 
            : window.location.origin;

        // 構建提示文本
        const prompt = `請為以下旅遊需求生成詳細的行程安排：
目的地：${destination}
出發日期：${startDate}
天數：${duration}天

請按照以下表格格式回覆每天的行程安排：

第1天 (${startDate})
時間 | 行程內容 | 交通方式 | 預估花費
09:00 | [景點名稱和活動描述] | [如何前往，交通工具] | [門票+交通費用]
12:00 | [用餐地點和餐廳名稱] | [如何前往，交通工具] | [餐費預估]
14:00 | [景點名稱和活動描述] | [如何前往，交通工具] | [門票+交通費用]
18:00 | [活動/用餐地點] | [如何前往，交通工具] | [餐費/活動費用]

第2天 (${getNextDate(startDate, 1)})
...（依此類推）

請使用24小時制的具體時間，並考慮當地節假日、開放時間等因素。`;

        try {
            console.log('發送請求到:', baseUrl);
            console.log('請求內容:', prompt);

            const response = await fetch(`${baseUrl}/api/chat`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                body: JSON.stringify({ 
                    message: prompt,
                    userAgent: navigator.userAgent,
                    platform: navigator.platform
                }),
                credentials: 'same-origin',  // 修改這裡
                mode: 'cors',
                cache: 'no-cache'
            });

            console.log('收到響應:', {
                status: response.status,
                ok: response.ok,
                statusText: response.statusText
            });

            if (!response.ok) {
                const errorText = await response.text();
                console.error('響應錯誤:', errorText);
                throw new Error(`請求失敗: ${response.status} ${response.statusText}`);
            }

            const text = await response.text();
            console.log('響應文本:', text.substring(0, 200) + '...');

            let data;
            try {
                data = JSON.parse(text);
            } catch (e) {
                console.error('JSON 解析錯誤:', e);
                console.log('完整響應文本:', text);
                throw new Error('伺服器響應格式錯誤');
            }

            if (!data.success) {
                throw new Error(data.error || '生成失敗');
            }

            return data.response;

        } catch (error) {
            console.error('生成行程請求錯誤:', {
                error: error,
                message: error.message,
                status: error.response?.status,
                data: error.response?.data,
                url: baseUrl,
                userAgent: navigator.userAgent
            });

            // 改進錯誤信息
            if (error.message.includes('Failed to fetch')) {
                throw new Error('無法連接到伺服器，請確保網絡連接正常');
            } else if (error.message.includes('NetworkError')) {
                throw new Error('網絡錯誤，請檢查您的網絡連接');
            } else if (error.message.includes('TypeError')) {
                throw new Error('請求錯誤，請稍後重試');
            }

            throw new Error(
                /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
                    ? '網絡連接不穩定，請確保網絡正常並重試'
                    : `請求失敗: ${error.message}`
            );
        }
    }

    function createDummyCard(dayNumber) {
        const weekdays = ['日', '一', '二', '三', '四', '五', '六'];
        const date = getNextDate(startDateInput.value, dayNumber - 1);
        const weekday = weekdays[new Date(date).getDay()];

        const card = document.createElement('div');
        card.className = 'day-card';
        card.innerHTML = `
            <h3>第 ${dayNumber} 天 (${date} 星期${weekday})</h3>
            <table class="itinerary-table loading">
                <tr>
                    <th>時間</th>
                    <th>行程內容</th>
                    <th>交通方式</th>
                    <th>預估花費</th>
                </tr>
                <tr>
                    <td>09:00</td>
                    <td><div class="loading-line"></div></td>
                    <td><div class="loading-line"></div></td>
                    <td><div class="loading-line"></div></td>
                </tr>
                <tr>
                    <td>12:00</td>
                    <td><div class="loading-line"></div></td>
                    <td><div class="loading-line"></div></td>
                    <td><div class="loading-line"></div></td>
                </tr>
                <tr>
                    <td>14:00</td>
                    <td><div class="loading-line"></div></td>
                    <td><div class="loading-line"></div></td>
                    <td><div class="loading-line"></div></td>
                </tr>
                <tr>
                    <td>18:00</td>
                    <td><div class="loading-line"></div></td>
                    <td><div class="loading-line"></div></td>
                    <td><div class="loading-line"></div></td>
                </tr>
            </table>
        `;

        requestAnimationFrame(() => {
            card.classList.add('visible');
        });

        return card;
    }

    async function searchImage(query) {
        const baseUrl = window.location.hostname === 'localhost' 
            ? 'http://localhost:3000' 
            : window.location.origin;

        try {
            const response = await fetch(`${baseUrl}/api/image`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                body: JSON.stringify({ 
                    query: query.replace(/[^\w\s\u4e00-\u9fff]/g, ''),
                    userAgent: navigator.userAgent,
                    platform: navigator.platform
                }),
                credentials: 'include',
                mode: 'cors',
                cache: 'no-cache'
            });

            if (!response.ok) {
                throw new Error(`圖片搜索失敗: ${response.status}`);
            }

            const data = await response.json();
            return data.success ? data.imageUrl : null;

        } catch (error) {
            console.error('圖片搜索錯誤:', {
                error: error,
                query: query,
                userAgent: navigator.userAgent
            });
            return null;
        }
    }

    async function displayResult(destination, duration, itinerary) {
        currentItinerary = itinerary;
        const days = itinerary.split(/第\s*\d+\s*天/).filter(Boolean);
        
        const weekdays = ['日', '一', '二', '三', '四', '五', '六'];
        
        for (let i = 0; i < days.length; i++) {
            const dayContent = days[i].trim();
            const card = document.querySelector(`.day-card:nth-child(${i + 1})`);
            
            if (card) {
                card.classList.remove('visible');
                await new Promise(resolve => setTimeout(resolve, 300));

                const rows = dayContent.split('\n')
                    .filter(row => row.includes('|'))
                    .map(row => row.trim())
                    .filter(row => {
                        const cells = row.split('|').map(cell => cell.trim());
                        return row && 
                               !row.includes('間 |') && 
                               cells.some(cell => cell && cell !== '-');
                    });

                const tableData = rows.map(row => {
                    const [time, activity, transport, cost] = row.split('|').map(cell => {
                        return cell.trim().replace(/^[-\s]+/, '');
                    });
                    
                    return {
                        time: time || '-',
                        activity: activity || '-',
                        transport: transport || '-',
                        cost: cost || '-'
                    };
                });

                const currentDate = getNextDate(startDateInput.value, i);
                const weekday = weekdays[new Date(currentDate).getDay()];

                let newContent = `
                    <h3>第 ${i + 1} 天 (${currentDate} 星期${weekday})</h3>
                    <table class="itinerary-table">
                        <tr>
                            <th>時間</th>
                            <th>行程內容</th>
                            <th>交通方式</th>
                            <th>預估花費</th>
                        </tr>
                `;

                const rowsWithImages = await Promise.all(
                    tableData.map(async row => {
                        let imageHtml = '';
                        try {
                            const imageUrl = await searchImage(`${destination} ${row.activity}`);
                            if (imageUrl) {
                                imageHtml = `
                                    <div class="activity-media">
                                        <img src="${imageUrl}" 
                                             alt="${row.activity}" 
                                             class="activity-image"
                                             onerror="this.style.display='none'"
                                        />
                                    </div>
                                `;
                            }
                        } catch (error) {
                            console.error('圖片載入錯誤:', error);
                        }

                        return `
                            <tr>
                                <td>${row.time}</td>
                                <td>
                                    <div class="activity-content">
                                        <div class="activity-info">
                                            ${row.activity}
                                        </div>
                                        ${imageHtml}
                                    </div>
                                </td>
                                <td>${row.transport}</td>
                                <td>${row.cost}</td>
                            </tr>
                        `;
                    })
                );

                newContent += rowsWithImages.join('') + '</table>';

                card.innerHTML = newContent;
                
                requestAnimationFrame(() => {
                    card.classList.add('visible');
                    const table = card.querySelector('.itinerary-table');
                    table.classList.add('visible');
                });

                await new Promise(resolve => setTimeout(resolve, 500));
            }
        }
    }

    async function handleSearch() {
        const destination = destinationInput.value.trim();
        const duration = parseInt(durationInput.value);
        const startDate = startDateInput.value;

        if (!destination || !duration || !startDate) {
            showError('請填寫所有必��資訊', '請確保已填寫目的地、日期和天數');
            return;
        }

        searchButton.disabled = true;
        searchButton.textContent = '生成中...';

        try {
            document.getElementById('destinationDisplay').textContent = destination;
            document.getElementById('durationDisplay').textContent = duration;
            showResultPage();

            const cardsContainer = document.getElementById('itineraryCards');
            cardsContainer.innerHTML = ''; // 清空現有內容

            for (let i = 1; i <= duration; i++) {
                const card = createDummyCard(i);
                cardsContainer.appendChild(card);
                await new Promise(resolve => setTimeout(resolve, 150));
            }

            let retries = 0;
            const maxRetries = 2;

            while (retries <= maxRetries) {
                try {
                    const itinerary = await generateItinerary(destination, duration, startDate);
                    await displayResult(destination, duration, itinerary);
                    break;
                } catch (error) {
                    console.error(`生成嘗試 ${retries + 1}/${maxRetries + 1} 失敗:`, error);
                    
                    if (retries === maxRetries) {
                        throw error;
                    }
                    
                    retries++;
                    await new Promise(resolve => setTimeout(resolve, 2000 * retries));
                }
            }

        } catch (error) {
            console.error('生成行程錯誤:', error);
            const errorDetails = {
                name: error.name,
                message: error.message,
                stack: error.stack,
                status: error.response?.status,
                response: error.response?.data,
                timestamp: new Date().toISOString(),
                userAgent: navigator.userAgent
            };

            console.log('完整錯誤信息:', errorDetails);

            showError(
                '生成行程時發生錯誤',
                /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
                    ? '請檢查網絡連接並重試'
                    : error.message,
                errorDetails
            );
        } finally {
            searchButton.disabled = false;
            searchButton.textContent = '搜尋行程';
        }
    }

    searchButton.addEventListener('click', handleSearch);
    backButton.addEventListener('click', showSearchPage);

    // 設置日期選擇器的最小日期為今天
    const today = new Date();
    const minDate = today.toISOString().split('T')[0];
    startDateInput.min = minDate;
    startDateInput.value = minDate;

    // 監聽日期變更事件
    startDateInput.addEventListener('change', (e) => {
        const selectedDate = new Date(e.target.value);
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        // 如果選擇的日期早於今天，則設置為今天
        if (selectedDate < today) {
            startDateInput.value = minDate;
        }
    });

    // 輔助函數：計算下一天的日期
    function getNextDate(dateString, days) {
        try {
            const date = new Date(dateString);
            if (isNaN(date.getTime())) {
                console.error('無效的日期:', dateString);
                return dateString; // 如果日期無效，返回原始字符串
            }
            
            date.setDate(date.getDate() + days);
            
            // 格式化日期為 YYYY-MM-DD
            const year = date.getFullYear();
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const day = String(date.getDate()).padStart(2, '0');
            
            return `${year}-${month}-${day}`;
        } catch (error) {
            console.error('日期計算錯誤:', error);
            return dateString; // 發生錯誤時返回原始字符串
        }
    }

    async function checkProxyStatus() {
        const proxyStatus = document.getElementById('proxyStatus');
        const proxyInfo = document.querySelector('.proxy-info');
        const proxyHost = document.getElementById('proxyHost');
        const proxyConnection = document.getElementById('proxyConnection');

        try {
            const response = await fetch('/api/proxy-status');
            const data = await response.json();

            if (data.enabled) {
                proxyStatus.textContent = '已啟用';
                proxyStatus.className = 'proxy-value success';
                proxyHost.textContent = data.host || '未知';
                proxyConnection.textContent = data.connected ? '已連接' : '未連接';
                proxyConnection.className = `proxy-value ${data.connected ? 'success' : 'error'}`;
                proxyInfo.classList.add('visible');
            } else {
                proxyStatus.textContent = '未啟用';
                proxyStatus.className = 'proxy-value error';
                proxyInfo.classList.remove('visible');
            }
        } catch (error) {
            console.error('檢查代理狀態失敗:', error);
            proxyStatus.textContent = '檢查失敗';
            proxyStatus.className = 'proxy-value error';
            proxyInfo.classList.remove('visible');
        }
    }

    // 定期檢查代理狀態
    checkProxyStatus();
    setInterval(checkProxyStatus, 30000); // 每30秒檢查一次
});