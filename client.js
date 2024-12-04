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

    // 設置日期選擇器的最小日期為今天
    const today = new Date();
    const minDate = today.toISOString().split('T')[0];
    startDateInput.min = minDate;
    startDateInput.value = minDate;

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
            const response = await fetch(`${baseUrl}/api/chat`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                body: JSON.stringify({ message: prompt }),
                credentials: 'same-origin'
            });

            if (!response.ok) {
                const errorText = await response.text();
                console.error('API Error Response:', errorText);
                throw new Error(response.status === 429 
                    ? 'Too many requests. Please wait a moment and try again.' 
                    : 'Failed to generate itinerary');
            }

            const data = await response.json();
            if (!data.success) {
                throw new Error(data.error || 'Failed to generate itinerary');
            }

            return data.response;

        } catch (error) {
            console.error('Itinerary Generation Error:', error);
            throw new Error(error.message || 'Failed to generate itinerary');
        }
    }

    // 錯誤處理函數
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

    // UI 相關函數
    function generateCalendarStrip(startDate, duration) {
        const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        calendarStrip.innerHTML = '';

        for (let i = 0; i < duration; i++) {
            const date = new Date(startDate);
            date.setDate(date.getDate() + i);
            
            const dayDiv = document.createElement('div');
            dayDiv.className = 'calendar-day';
            dayDiv.innerHTML = `
                <span class="calendar-weekday">${weekdays[date.getDay()]}</span>
                <span class="calendar-date${i === 0 ? ' active' : ''}">${date.getDate()}</span>
            `;
            
            dayDiv.addEventListener('click', () => {
                document.querySelectorAll('.calendar-date').forEach(d => d.classList.remove('active'));
                dayDiv.querySelector('.calendar-date').classList.add('active');
                showDayItinerary(i + 1);
            });

            calendarStrip.appendChild(dayDiv);
        }
    }

    function showDayItinerary(dayNumber) {
        const cards = document.querySelectorAll('.activity-card');
        cards.forEach(card => {
            card.style.display = card.dataset.day === String(dayNumber) ? 'flex' : 'none';
        });
    }

    function createActivityCard(activity, dayNumber) {
        const card = document.createElement('div');
        card.className = 'activity-card';
        card.dataset.day = dayNumber;
        
        card.innerHTML = `
            <div class="activity-time">
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

    // 主要搜索函數
    async function handleSearch() {
        const destination = destinationInput.value.trim();
        const duration = parseInt(durationInput.value);
        const startDate = startDateInput.value;

        if (!destination || !duration || !startDate) {
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

            // 顯示結果頁面
            searchContainer.style.display = 'none';
            resultPage.classList.remove('hidden');

            // 生成日曆條
            generateCalendarStrip(startDate, duration);

            // 生成行程
            const itinerary = await generateItinerary(destination, duration, startDate);
            const cardsContainer = document.getElementById('itineraryCards');
            cardsContainer.innerHTML = '';

            itinerary.forEach(day => {
                day.activities.forEach(activity => {
                    const card = createActivityCard(activity, day.day);
                    cardsContainer.appendChild(card);
                });
            });

            // 默認顯示第一天的行程
            showDayItinerary(1);

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
    backButton.addEventListener('click', () => {
        searchContainer.style.display = 'flex';
        resultPage.classList.add('hidden');
    });

    // 清除按鈕功能
    document.querySelectorAll('.clear-input').forEach(button => {
        button.addEventListener('click', () => {
            const inputId = button.dataset.input;
            const input = document.getElementById(inputId);
            input.value = '';
            input.focus();
        });
    });
});