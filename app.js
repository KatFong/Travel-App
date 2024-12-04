document.addEventListener('DOMContentLoaded', () => {
    const searchButton = document.getElementById('searchButton');
    const backButton = document.getElementById('backButton');
    const searchContainer = document.querySelector('.search-container');
    const resultPage = document.getElementById('resultPage');
    const destinationInput = document.getElementById('destination');
    const durationInput = document.getElementById('duration');

    // 處理瀏覽器自動填充
    function handleAutofill() {
        // 檢查輸入值是否來自自動填充
        if (destinationInput.value) {
            destinationInput.dispatchEvent(new Event('input'));
        }
        if (durationInput.value) {
            durationInput.dispatchEvent(new Event('input'));
        }
    }

    // 監聽自動填充事件
    destinationInput.addEventListener('animationstart', (e) => {
        if (e.animationName === 'onAutoFillStart') {
            handleAutofill();
        }
    });

    durationInput.addEventListener('animationstart', (e) => {
        if (e.animationName === 'onAutoFillStart') {
            handleAutofill();
        }
    });

    // 監聽 change 事件
    destinationInput.addEventListener('change', () => {
        if (destinationInput.value) {
            destinationInput.dataset.hasValue = 'true';
        } else {
            delete destinationInput.dataset.hasValue;
        }
    });

    durationInput.addEventListener('change', () => {
        if (durationInput.value) {
            durationInput.dataset.hasValue = 'true';
        } else {
            delete durationInput.dataset.hasValue;
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

    async function handleSearch(isRetry = false) {
        const destination = destinationInput.value.trim();
        const duration = durationInput.value;

        if (!isRetry) {  // 只在首次搜尋時檢查輸入
            if (!destination || !duration) {
                if (!destination) destinationInput.classList.add('error');
                if (!duration) durationInput.classList.add('error');
                alert('請填寫目的地和停留天數');
                return;
            }

            if (duration < 1 || duration > 30) {
                alert('停留天數需要在 1-30 天之間');
                return;
            }

            destinationInput.classList.remove('error');
            durationInput.classList.remove('error');
        }

        try {
            if (!isRetry) {
                document.getElementById('destinationDisplay').textContent = destination;
                document.getElementById('durationDisplay').textContent = duration;
                showResultPage();
            }

            // 禁用當前使用的按鈕
            const currentButton = isRetry ? 
                document.getElementById('retryButton') : 
                searchButton;
            
            if (currentButton) {
                currentButton.disabled = true;
                currentButton.textContent = '生成中...';
            }

            // 準備卡片容器
            const cardsContainer = document.getElementById('itineraryCards');
            cardsContainer.innerHTML = '';

            // 逐個添加並顯示臨時卡片
            for (let i = 1; i <= duration; i++) {
                const card = createDummyCard(i);
                card.style.opacity = '0';
                cardsContainer.appendChild(card);
                await new Promise(resolve => setTimeout(resolve, 150));
                card.style.opacity = '1';
            }

            // 在背景生成實際內容
            const [destinationInfo, itinerary] = await Promise.all([
                getDestinationInfo(destination),
                generateItinerary(destination, duration)
            ]);

            // 移除重試按鈕（如果存在）
            const retryButton = document.getElementById('retryButton');
            if (retryButton) {
                retryButton.remove();
            }

            // 等待所有臨時卡片顯示完成後，開始更新實際內容
            await new Promise(resolve => setTimeout(resolve, 300));
            await displayResult(destination, duration, itinerary, destinationInfo);

        } catch (error) {
            console.error('生成行程錯誤:', error);
            
            // 檢查是否是請求限制錯誤
            const isRateLimit = error.message.includes('請求限制') || error.message.includes('請求太頻繁');
            const retryAfter = isRateLimit ? parseInt(error.message.match(/\d+/)[0]) : 30;
            
            const cardsContainer = document.getElementById('itineraryCards');
            cardsContainer.innerHTML = `
                <div class="error-container">
                    <div class="error-message">
                        <p>${isRateLimit ? '請求頻率超出限制' : '生成行程時發生錯誤'}</p>
                        <p class="error-details">${error.message}</p>
                        ${isRateLimit ? `<div class="retry-timer" id="retryTimer">將在 ${retryAfter} 秒後自動重試</div>` : ''}
                    </div>
                    <button id="retryButton" class="retry-button" ${isRateLimit ? 'disabled' : ''}>
                        ${isRateLimit ? `等待重試 (${retryAfter}s)` : '重新生成'}
                    </button>
                </div>
            `;

            const retryButton = document.getElementById('retryButton');
            const retryTimer = document.getElementById('retryTimer');

            if (isRateLimit && retryButton && retryTimer) {
                // 開始倒計時
                let timeLeft = retryAfter;
                const countdownInterval = setInterval(() => {
                    timeLeft--;
                    if (timeLeft <= 0) {
                        clearInterval(countdownInterval);
                        retryButton.disabled = false;
                        retryButton.textContent = '重新生成';
                        retryTimer.textContent = '可以重試了';
                        // 自動重試
                        handleSearch(true);
                    } else {
                        retryButton.textContent = `等待重試 (${timeLeft}s)`;
                        retryTimer.textContent = `將在 ${timeLeft} 秒後自動重試`;
                    }
                }, 1000);
            } else {
                // 非請求限制錯誤的處理
                const retryHandler = async () => {
                    const retryBtn = document.getElementById('retryButton');
                    if (retryBtn) {
                        retryBtn.removeEventListener('click', retryHandler);
                        await handleSearch(true);
                    }
                };

                if (retryButton) {
                    retryButton.addEventListener('click', retryHandler);
                }
            }
        } finally {
            if (!isRetry) {
                searchButton.disabled = false;
                searchButton.textContent = '搜尋行程';
            }
        }
    }

    function createDummyCard(dayNumber) {
        const card = document.createElement('div');
        card.className = 'day-card';
        card.innerHTML = `
            <h3>第 ${dayNumber} 天</h3>
            <div class="activity-item">
                <div class="loading-placeholder" style="width: 100%"></div>
                <div class="loading-placeholder" style="width: 80%"></div>
                <div class="loading-placeholder" style="width: 60%"></div>
            </div>
            <div class="activity-item">
                <div class="loading-placeholder" style="width: 90%"></div>
                <div class="loading-placeholder" style="width: 70%"></div>
            </div>
            <div class="activity-item">
                <div class="loading-placeholder" style="width: 85%"></div>
                <div class="loading-placeholder" style="width: 75%"></div>
            </div>
        `;

        // 使用 requestAnimationFrame 來確保動畫效果
        requestAnimationFrame(() => {
            card.classList.add('visible');
        });

        return card;
    }

    async function displayResult(destination, duration, itinerary, destinationInfo) {
        const days = itinerary.split(/第\s*\d+\s*天/).filter(Boolean);
        
        for (let i = 0; i < days.length; i++) {
            const dayContent = days[i].trim();
            const card = document.querySelector(`.day-card:nth-child(${i + 1})`);
            
            if (card) {
                card.classList.remove('visible');
                await new Promise(resolve => setTimeout(resolve, 300));

                const sections = dayContent.split(/(?=行程安排：|交通方式：|預估花費：|注意事項：)/).filter(Boolean);
                let newContent = `<h3>第 ${i + 1} 天</h3>`;

                for (const section of sections) {
                    const sectionText = section.trim();
                    if (sectionText.startsWith('行程安排：')) {
                        newContent += `
                            <div class="activity-item">
                                <span class="info-tag schedule-tag">行程</span>
                                ${sectionText.replace('行程安排：', '')}
                            </div>
                        `;
                    } else if (sectionText.startsWith('交通方式：')) {
                        newContent += `
                            <div class="activity-item">
                                <span class="info-tag transport-tag">交通</span>
                                ${sectionText.replace('交通方式：', '')}
                            </div>
                        `;
                    } else if (sectionText.startsWith('預估花費：')) {
                        newContent += `
                            <div class="activity-item">
                                <span class="info-tag cost-tag">花費</span>
                                ${sectionText.replace('預估花費：', '')}
                            </div>
                        `;
                    } else if (sectionText.startsWith('注意事項：')) {
                        newContent += `
                            <div class="activity-item">
                                <span class="info-tag notice-tag">注意</span>
                                ${sectionText.replace('注意事項：', '')}
                            </div>
                        `;
                    }
                }

                card.innerHTML = newContent;
                
                // 使用 requestAnimationFrame 來確保動畫效果
                requestAnimationFrame(() => {
                    card.classList.add('visible');
                    const items = card.querySelectorAll('.activity-item');
                    items.forEach((item, index) => {
                        setTimeout(() => {
                            item.classList.add('visible');
                        }, index * 100);
                    });
                });

                await new Promise(resolve => setTimeout(resolve, 500));
            }
        }
    }

    searchButton.addEventListener('click', handleSearch);
    backButton.addEventListener('click', showSearchPage);
}); 