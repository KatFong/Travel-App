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
        console.log('使用的日期:', startDate);
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

        const response = await fetch('http://localhost:3000/api/chat', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ message: prompt })
        });

        const data = await response.json();
        if (!data.success) {
            throw new Error(data.error);
        }
        return data.response;
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
        try {
            // 添加重試邏輯
            let retries = 0;
            const maxRetries = 2;
            const baseDelay = 1000;

            while (retries <= maxRetries) {
                try {
                    const response = await fetch('http://localhost:3000/api/image', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({ 
                            query: query.replace(/[^\w\s\u4e00-\u9fff]/g, '') // 清理查詢字符串
                        })
                    });
                    
                    // 檢查響應狀態
                    if (!response.ok) {
                        throw new Error(`HTTP error! status: ${response.status}`);
                    }

                    // 嘗試解析 JSON
                    const text = await response.text();
                    let data;
                    try {
                        data = JSON.parse(text);
                    } catch (e) {
                        console.error('JSON 解析錯誤:', e);
                        console.log('收到的響應:', text.substring(0, 200));
                        throw new Error('無效的 JSON 響應');
                    }

                    if (!data.success) {
                        throw new Error(data.error || '圖片搜索失敗');
                    }

                    return data.imageUrl;

                } catch (error) {
                    console.error(`圖片搜索嘗試 ${retries + 1}/${maxRetries + 1} 失敗:`, error);
                    
                    if (retries === maxRetries) {
                        throw error;
                    }

                    // 等待後重試
                    await new Promise(resolve => setTimeout(resolve, baseDelay * Math.pow(2, retries)));
                    retries++;
                }
            }
        } catch (error) {
            console.error('圖片搜索最終失敗:', error);
            return null; // 返回 null 而不是拋出錯誤，這樣不會影響整體行程顯示
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
            showError('請填寫所有必要資訊', '請確保已填寫目的地、日期和天數');
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
});