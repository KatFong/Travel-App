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

    async function handleChatMessage(message) {
        const userDiv = document.createElement('div');
        userDiv.className = 'chat-message user';
        userDiv.textContent = message;
        chatMessages.appendChild(userDiv);
        chatMessages.scrollTop = chatMessages.scrollHeight;

        try {
            const prompt = `基於以下現有行程：
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
            const aiDiv = document.createElement('div');
            aiDiv.className = 'chat-message ai error';
            aiDiv.textContent = '調整行程時發生錯誤：' + error.message;
            chatMessages.appendChild(aiDiv);
            chatMessages.scrollTop = chatMessages.scrollHeight;
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
        const card = document.createElement('div');
        card.className = 'day-card';
        card.innerHTML = `
            <h3>第 ${dayNumber} 天</h3>
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

    async function displayResult(destination, duration, itinerary) {
        currentItinerary = itinerary;
        const days = itinerary.split(/第\s*\d+\s*天/).filter(Boolean);
        
        for (let i = 0; i < days.length; i++) {
            const dayContent = days[i].trim();
            const card = document.querySelector(`.day-card:nth-child(${i + 1})`);
            
            if (card) {
                card.classList.remove('visible');
                await new Promise(resolve => setTimeout(resolve, 300));

                // 解析表格內容，跳過標題行和分隔行
                const rows = dayContent.split('\n')
                    .filter(row => row.includes('|'))
                    .filter((row, index) => {
                        const cells = row.split('|').map(cell => cell.trim());
                        // 跳過包含 "時間"、"行程內容" 等表頭的行
                        return !cells.some(cell => 
                            ['時間', '行程內容', '交通方式', '預估花費', '---'].includes(cell)
                        );
                    });

                const tableData = rows.map(row => {
                    const cells = row.split('|').map(cell => cell.trim());
                    // 確保至少有4個欄位
                    while (cells.length < 4) cells.push('-');
                    return {
                        time: cells[0],
                        activity: cells[1],
                        transport: cells[2],
                        cost: cells[3]
                    };
                });

                let newContent = `
                    <h3>第 ${i + 1} 天 ${startDate ? `(${getNextDate(startDate, i)})` : ''}</h3>
                    <table class="itinerary-table">
                        <tr>
                            <th>時間</th>
                            <th>行程內容</th>
                            <th>交通方式</th>
                            <th>預估花費</th>
                        </tr>
                        ${tableData.map(row => `
                            <tr>
                                <td>${row.time || '-'}</td>
                                <td>${row.activity || '-'}</td>
                                <td>${row.transport || '-'}</td>
                                <td>${row.cost || '-'}</td>
                            </tr>
                        `).join('')}
                    </table>
                `;

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
            alert('請填寫所有必要資訊');
            return;
        }

        searchButton.disabled = true;
        searchButton.textContent = '生成中...';

        try {
            document.getElementById('destinationDisplay').textContent = destination;
            document.getElementById('durationDisplay').textContent = duration;
            showResultPage();

            const cardsContainer = document.getElementById('itineraryCards');
            if (!cardsContainer.children.length) {
                for (let i = 1; i <= duration; i++) {
                    const card = createDummyCard(i);
                    cardsContainer.appendChild(card);
                    await new Promise(resolve => setTimeout(resolve, 150));
                }
            }

            const itinerary = await generateItinerary(destination, duration, startDate);
            await displayResult(destination, duration, itinerary);

        } catch (error) {
            const errorDiv = document.createElement('div');
            errorDiv.className = 'error-container';
            errorDiv.innerHTML = `
                <div class="error-message">
                    <p>生成行程時發生錯誤</p>
                    <p class="error-details">${error.message}</p>
                </div>
                <button id="retryButton" class="retry-button">重新生成</button>
            `;

            const oldError = document.querySelector('.error-container');
            if (oldError) {
                oldError.remove();
            }

            const cardsContainer = document.getElementById('itineraryCards');
            cardsContainer.appendChild(errorDiv);

            document.getElementById('retryButton').addEventListener('click', () => {
                handleSearch();
            });

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

    // 輔助函數：計算下一天的日期
    function getNextDate(dateString, days) {
        const date = new Date(dateString);
        date.setDate(date.getDate() + days);
        return date.toISOString().split('T')[0];
    }
});