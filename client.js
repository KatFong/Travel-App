document.addEventListener('DOMContentLoaded', () => {
    // 獲取 DOM 元素
    const searchButton = document.getElementById('searchButton');
    const backButton = document.getElementById('backButton');
    const searchContainer = document.querySelector('.search-container');
    const resultPage = document.getElementById('resultPage');
    const destinationInput = document.getElementById('destination');
    const durationInput = document.getElementById('duration');
    const startDateInput = document.getElementById('startDate');
    const calendarStrip = document.getElementById('calendarStrip');
    const itineraryCards = document.getElementById('itineraryCards');
    const mainBackButton = document.querySelector('.search-container .back-button');
    const resultBackButton = document.getElementById('backButton');

    // 設置日期選擇器的最小日期為今天
    const today = new Date();
    const minDate = today.toISOString().split('T')[0];
    startDateInput.min = minDate;
    startDateInput.value = minDate;

    // 基礎函數
    function showError(title, message) {
        const template = document.getElementById('errorTemplate');
        const clone = template.content.cloneNode(true);
        const overlay = document.getElementById('overlay');

        clone.querySelector('.error-title').textContent = title;
        clone.querySelector('.error-message').textContent = message;

        const errorPopup = clone.querySelector('.error-popup');
        document.body.appendChild(errorPopup);
        overlay.classList.add('visible');

        const tryAgainButton = errorPopup.querySelector('.error-button');
        tryAgainButton.addEventListener('click', () => {
            errorPopup.remove();
            overlay.classList.remove('visible');
            handleSearch();
        });

        overlay.addEventListener('click', () => {
            errorPopup.remove();
            overlay.classList.remove('visible');
        });
    }

    function generateCalendarStrip(startDate, duration) {
        const weekdays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
        calendarStrip.innerHTML = '';

        const stripInner = document.createElement('div');
        stripInner.className = 'calendar-strip-inner';

        const startDay = new Date(startDate);
        while (startDay.getDay() !== 1) {
            startDay.setDate(startDay.getDate() - 1);
        }

        const endDate = new Date(startDate);
        endDate.setDate(endDate.getDate() + duration - 1);

        for (let i = 0; i < 28; i++) {
            const date = new Date(startDay);
            date.setDate(date.getDate() + i);
            
            const dayDiv = document.createElement('div');
            dayDiv.className = 'calendar-day';
            dayDiv.dataset.date = date.toISOString();
            
            const isTripDay = date >= new Date(startDate) && date <= endDate;
            const isFirstDay = date.toDateString() === new Date(startDate).toDateString();
            
            dayDiv.innerHTML = `
                <span class="calendar-weekday">${weekdays[date.getDay() === 0 ? 6 : date.getDay() - 1]}</span>
                <span class="calendar-date${isFirstDay ? ' active' : ''}${isTripDay ? ' trip-day' : ''}">${date.getDate()}</span>
            `;

            stripInner.appendChild(dayDiv);
        }

        calendarStrip.appendChild(stripInner);
    }

    function createActivityCard(activity, dayNumber, date) {
        const card = document.createElement('div');
        card.className = 'activity-card';
        card.dataset.day = dayNumber;
        card.dataset.date = date.toISOString();
        
        const formattedDate = date.toLocaleDateString('en-US', {
            weekday: 'short',
            month: 'short',
            day: 'numeric'
        });
        
        card.innerHTML = `
            <div class="activity-time">
                <div class="date">${formattedDate}</div>
                <span class="hour">${activity.time}</span>
            </div>
            <div class="activity-content">
                <div class="activity-title">${activity.activity}</div>
                <div class="activity-location">
                    <svg width="16" height="16" viewBox="0 0 24 24">
                        <path fill="#6B7280" d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
                    </svg>
                    ${activity.transport}
                </div>
                <div class="activity-cost">${activity.cost}</div>
            </div>
        `;

        return card;
    }

    function showDayItinerary(dayNumber) {
        const targetCard = document.querySelector(`.activity-card[data-day="${dayNumber}"]`);
        if (targetCard) {
            targetCard.scrollIntoView({
                behavior: 'smooth',
                block: 'start'
            });
        }
    }

    // API 函數
    async function generateItinerary(destination, duration, startDate) {
        const baseUrl = window.location.hostname === 'localhost' 
            ? 'http://localhost:3000' 
            : window.location.origin;

        const prompt = `Destination: ${destination}
Duration: ${duration} days
Start Date: ${startDate}

Please provide a detailed travel itinerary.`;

        try {
            console.log('Sending request to:', baseUrl);
            console.log('Request data:', {
                destination,
                duration,
                startDate,
                prompt
            });

            console.log('API Request:', {
                destination,
                duration,
                startDate: startDate.toISOString(),
                formattedStartDate: startDate.toLocaleDateString()
            });

            const response = await fetch(`${baseUrl}/api/chat`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                body: JSON.stringify({ 
                    message: prompt,
                    destination,
                    duration,
                    startDate
                }),
                credentials: 'same-origin'
            });

            console.log('Response status:', response.status);
            console.log('Response headers:', response.headers);

            if (!response.ok) {
                const errorText = await response.text();
                console.error('API Error Response:', {
                    status: response.status,
                    statusText: response.statusText,
                    errorText: errorText
                });
                throw new Error(response.status === 429 
                    ? 'Too many requests. Please wait a moment and try again.' 
                    : `Failed to generate itinerary: ${response.status} ${response.statusText}`);
            }

            const responseText = await response.text();
            console.log('Raw response text:', responseText);

            let data;
            try {
                data = JSON.parse(responseText);
            } catch (e) {
                console.error('JSON parse error:', e);
                throw new Error('Invalid response format from server');
            }

            console.log('Parsed response:', data);

            if (!data.success) {
                throw new Error(data.error || 'Failed to generate itinerary');
            }

            console.log('Gemini Response:', {
                rawResponse: data.response,
                isArray: Array.isArray(data.response),
                firstDay: Array.isArray(data.response) ? data.response[0] : null
            });

            return data.response;

        } catch (error) {
            console.error('Itinerary Generation Error:', {
                error: error,
                message: error.message,
                stack: error.stack
            });
            throw error;
        }
    }

    // 添加頁面刷新處理
    function handlePageRefresh() {
        // 檢查 URL 參數
        const urlParams = new URLSearchParams(window.location.search);
        const isResult = urlParams.get('view') === 'result';
        
        if (isResult) {
            // 如果是結果頁面，返回搜索頁面
            searchContainer.style.display = 'flex';
            resultPage.classList.add('hidden');
            itineraryCards.innerHTML = '';
            calendarStrip.innerHTML = '';
            // 清除 URL 參數
            window.history.replaceState({}, '', window.location.pathname);
        }
    }

    // 修改 handleSearch 函數
    async function handleSearch() {
        console.log('Starting search with:', {
            destination: destinationInput.value,
            duration: durationInput.value,
            startDate: startDateInput.value
        });

        const destination = destinationInput.value.trim();
        const duration = parseInt(durationInput.value);
        const tripStartDate = new Date(startDateInput.value + 'T00:00:00');

        if (!destination || !duration || !tripStartDate) {
            showError(
                'Missing Information',
                'Please fill in all required fields: destination, dates, and duration.'
            );
            return;
        }

        if (duration < 1 || duration > 30) {
            showError(
                'Invalid Duration',
                'Please enter a duration between 1 and 30 days.'
            );
            return;
        }

        try {
            searchButton.disabled = true;
            searchButton.textContent = 'Generating...';

            // 添加 URL 參數
            window.history.pushState({}, '', `${window.location.pathname}?view=result`);

            searchContainer.style.display = 'none';
            resultPage.classList.remove('hidden');

            generateCalendarStrip(tripStartDate, duration);

            const response = await generateItinerary(destination, duration, tripStartDate);
            itineraryCards.innerHTML = '';

            // 檢查並處理響應數據
            if (Array.isArray(response)) {
                console.log('Start Date:', tripStartDate);
                console.log('Response Array:', response);
                
                response.forEach((day, index) => {
                    const dayDate = new Date(tripStartDate);
                    dayDate.setDate(tripStartDate.getDate() + (day.day - 1));
                    
                    console.log(`Day ${day.day} (${index + 1}):`, {
                        calculatedDate: dayDate.toLocaleDateString(),
                        activities: day.activities?.length || 0,
                        dayNumber: day.day
                    });
                    
                    if (day.activities && Array.isArray(day.activities)) {
                        // 為每天創建新的日期對象
                        day.activities.forEach(activity => {
                            const card = createActivityCard(activity, day.day, dayDate);
                            itineraryCards.appendChild(card);
                        });
                    }
                });
            } else if (typeof response === 'string') {
                const days = response.split(/第\s*\d+\s*天/).filter(Boolean);
                days.forEach((dayContent, index) => {
                    // 創建新的日期對象
                    const dayDate = new Date(tripStartDate);
                    dayDate.setDate(tripStartDate.getDate() + index);
                    
                    const activities = dayContent.split('\n')
                        .filter(line => line.includes('|'))
                        .map(line => {
                            const [time, activity, transport, cost] = line.split('|').map(item => item.trim());
                            return { time, activity, transport, cost };
                        });

                    activities.forEach(activity => {
                        // 為每個活動創建新的日期對象
                        const activityDate = new Date(dayDate);
                        const card = createActivityCard(activity, index + 1, activityDate);
                        itineraryCards.appendChild(card);
                    });
                });
            } else {
                throw new Error('Invalid response format');
            }

            showDayItinerary(1, new Date(tripStartDate));

        } catch (error) {
            console.error('Search error:', error);
            showError(
                'Generation Failed',
                error.message || 'Failed to generate itinerary. Please try again.'
            );
            searchContainer.style.display = 'flex';
            resultPage.classList.add('hidden');
        } finally {
            searchButton.disabled = false;
            searchButton.textContent = 'Next';
        }
    }

    // 事件監聽器
    searchButton.addEventListener('click', handleSearch);
    mainBackButton.addEventListener('click', () => {
        window.history.back();
    });
    resultBackButton.addEventListener('click', () => {
        searchContainer.style.display = 'flex';
        resultPage.classList.add('hidden');
        itineraryCards.innerHTML = '';
        calendarStrip.innerHTML = '';
        // 清除 URL 參數
        window.history.replaceState({}, '', window.location.pathname);
    });

    // 添加瀏覽器後退按鈕處理
    window.addEventListener('popstate', () => {
        handlePageRefresh();
    });

    // 頁面加載時檢查狀態
    handlePageRefresh();

    // 清除按鈕功能
    document.querySelectorAll('.clear-input').forEach(button => {
        button.addEventListener('click', () => {
            const inputId = button.dataset.input;
            const input = document.getElementById(inputId);
            input.value = '';
            input.focus();
        });
    });

    // 在 DOMContentLoaded 事件中添加
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const card = entry.target;
                const cardDate = new Date(card.dataset.date);
                
                // 更新日曆高亮
                document.querySelectorAll('.calendar-date').forEach(dateEl => {
                    const dateDiv = dateEl.closest('.calendar-day');
                    if (!dateDiv) return;
                    
                    const dayDate = new Date(dateDiv.dataset.date);
                    if (dayDate.toDateString() === cardDate.toDateString()) {
                        dateEl.classList.add('active');
                    } else {
                        dateEl.classList.remove('active');
                    }
                });
            }
        });
    }, {
        root: null,
        threshold: 0.5,
        rootMargin: '-100px 0px'
    });
});