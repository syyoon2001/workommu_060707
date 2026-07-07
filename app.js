const cityData = {
    '호주': ['시드니', '브리즈번', '멜버른'],
    '캐나다': ['밴쿠버', '토론토', '캘거리'],
    '일본': ['도쿄', '오사카', '교토']
};

function getDefaultUsers() {
    return {};
}

let users = {};
let currentUser = null;
let helpRequests = [];
let infoPosts = [];
let currentReviewingHistoryId = null;
let currentReviewRating = 0;

document.addEventListener('DOMContentLoaded', () => {
    initData();
    setupEventListeners();
    checkOnboardingState();
});

function initData() {
    // Load Users
    const savedUsers = localStorage.getItem('workommu_users');
    if (savedUsers) {
        users = JSON.parse(savedUsers);
        // Clear out old dummy users
        if (users.hasOwnProperty('user1') || users.hasOwnProperty('user2') || users.hasOwnProperty('user3')) {
            delete users['user1'];
            delete users['user2'];
            delete users['user3'];
            localStorage.setItem('workommu_users', JSON.stringify(users));
            // Reset onboarding since dummy users are deleted
            localStorage.removeItem('workommu_onboarded');
            localStorage.removeItem('workommu_current_user_id');
            currentUser = null;
        }
    } else {
        users = getDefaultUsers();
        localStorage.setItem('workommu_users', JSON.stringify(users));
    }

    // Load Current User ID
    const savedUserId = localStorage.getItem('workommu_current_user_id');
    if (savedUserId && users[savedUserId]) {
        currentUser = users[savedUserId];
    } else {
        const userKeys = Object.keys(users);
        if (userKeys.length > 0) {
            currentUser = users[userKeys[0]];
            localStorage.setItem('workommu_current_user_id', currentUser.id);
        } else {
            currentUser = null;
            localStorage.removeItem('workommu_current_user_id');
        }
    }

    // Load Posts & Requests
    const savedPosts = localStorage.getItem('workommu_info_posts');
    infoPosts = savedPosts ? JSON.parse(savedPosts) : [];

    const savedHelp = localStorage.getItem('workommu_help_requests');
    helpRequests = savedHelp ? JSON.parse(savedHelp) : [];
}

function saveAllData() {
    localStorage.setItem('workommu_users', JSON.stringify(users));
    if (currentUser) {
        localStorage.setItem('workommu_current_user_id', currentUser.id);
    }
    localStorage.setItem('workommu_info_posts', JSON.stringify(infoPosts));
    localStorage.setItem('workommu_help_requests', JSON.stringify(helpRequests));
}

function checkOnboardingState() {
    const onboarded = localStorage.getItem('workommu_onboarded');
    const onboarding = document.getElementById('onboarding-screen');
    const main = document.getElementById('main-content');
    const nav = document.getElementById('bottom-nav');
    const header = document.getElementById('app-header');

    if (onboarded === 'true') {
        onboarding.classList.add('hidden');
        onboarding.classList.remove('active');
        main.classList.remove('hidden');
        nav.classList.remove('hidden');
        header.classList.remove('hidden');
        
        document.getElementById('user-switcher').value = currentUser.id;
        updateAllUIs();
    } else {
        onboarding.classList.remove('hidden');
        onboarding.classList.add('active');
        main.classList.add('hidden');
        nav.classList.add('hidden');
        header.classList.add('hidden');
    }
}

function setupEventListeners() {
    const userSwitcher = document.getElementById('user-switcher');
    const infoPostForm = document.getElementById('info-post-form');
    const btnOpenHelp = document.getElementById('btn-open-help-modal');
    const btnCloseHelp = document.getElementById('btn-close-help-modal');
    const helpModal = document.getElementById('help-modal');
    const helpRequestForm = document.getElementById('help-request-form');

    // User Switcher
    userSwitcher.addEventListener('change', () => {
        currentUser = users[userSwitcher.value];
        saveAllData();
        updateAllUIs();
    });

    // Info Post Submit
    if (infoPostForm) {
        infoPostForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const title = document.getElementById('post-title').value;
            const content = document.getElementById('post-content').value;

            const newPost = {
                id: Date.now(),
                author: currentUser.name,
                title: title,
                content: content,
                date: new Date().toLocaleDateString(),
                country: currentUser.country
            };

            infoPosts.unshift(newPost);
            currentUser.helpCredit += 1;
            
            infoPostForm.reset();
            saveAllData();
            updateAllUIs();
            alert('글이 등록되었습니다! 1 CP를 획득하셨습니다.');
        });
    }

    // Help Modal handling
    if (btnOpenHelp) {
        btnOpenHelp.addEventListener('click', () => helpModal.classList.add('active'));
    }
    if (btnCloseHelp) {
        btnCloseHelp.addEventListener('click', () => helpModal.classList.remove('active'));
    }

    if (helpRequestForm) {
        helpRequestForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const categoryEl = document.getElementById('help-category');
            const category = categoryEl.value;
            const cost = parseInt(categoryEl.options[categoryEl.selectedIndex].getAttribute('data-cost'));
            const content = document.getElementById('help-content').value;
            const cityOnly = document.getElementById('help-city-only').checked;

            if (currentUser.helpCredit < cost) {
                alert('크레딧이 부족합니다.');
                return;
            }

            const newRequest = {
                id: Date.now(),
                author: currentUser.name,
                authorId: currentUser.id,
                job: currentUser.job,
                deundeunScore: currentUser.deundeunScore,
                country: currentUser.country,
                city: currentUser.city,
                category: category,
                content: content,
                cityOnly: cityOnly,
                cost: cost,
                status: 'open',
                responders: []
            };

            helpRequests.unshift(newRequest);
            currentUser.helpCredit -= cost;

            helpRequestForm.reset();
            helpModal.classList.remove('active');
            saveAllData();
            updateAllUIs();
            alert('도움 요청이 등록되었습니다! 크레딧이 차감되었습니다.');
        });
    }

    // Star Rating
    document.querySelectorAll('.star-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            currentReviewRating = parseInt(btn.getAttribute('data-value'));
            document.querySelectorAll('.star-btn').forEach(s => {
                s.classList.toggle('active', parseInt(s.getAttribute('data-value')) <= currentReviewRating);
            });
        });
    });

    // Review Modal closing
    document.getElementById('btn-close-review-modal').addEventListener('click', () => {
        document.getElementById('review-modal').classList.remove('active');
    });

    // Review Submit
    document.getElementById('btn-submit-review').addEventListener('click', () => {
        if (currentReviewRating === 0) {
            alert('별점을 선택해주세요.');
            return;
        }
        const comment = document.getElementById('review-comment').value;
        if (!comment.trim()) {
            alert('코멘트를 입력해주세요.');
            return;
        }
        completeReview(comment);
    });

    // Nav Items
    document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', () => switchView(item.getAttribute('data-view')));
    });

    document.getElementById('btn-go-home').addEventListener('click', () => switchView('home'));

    // Onboarding Form
    const onboardingForm = document.getElementById('onboarding-form');
    if (onboardingForm) {
        onboardingForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const name = document.getElementById('user-name').value;
            const country = document.getElementById('user-country').value;
            const city = document.getElementById('user-city').value;
            const job = document.getElementById('user-job').value;

            // Create new user based on onboarding
            const newUserId = `user_${Date.now()}`;
            const newUser = {
                id: newUserId,
                name: name,
                country: country,
                city: city,
                job: job,
                helpCredit: 10,
                deundeunScore: 30,
                history: []
            };

            users[newUserId] = newUser;
            currentUser = newUser;

            localStorage.setItem('workommu_onboarded', 'true');
            saveAllData();
            
            // Clear form inputs
            onboardingForm.reset();
            
            checkOnboardingState();
        });
    }


    // Country-City sync logic
    const countrySelect = document.getElementById('user-country');
    const citySelect = document.getElementById('user-city');
    if (countrySelect && citySelect) {
        countrySelect.addEventListener('change', () => {
            const cities = cityData[countrySelect.value] || [];
            citySelect.innerHTML = '<option value="" disabled selected>도시를 선택해주세요</option>' + 
                                  cities.map(c => `<option value="${c}">${c}</option>`).join('');
            citySelect.disabled = false;
        });
    }
}

function switchView(viewName) {
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    const view = document.getElementById(`view-${viewName}`);
    if (view) view.classList.add('active');
    
    document.querySelectorAll('.nav-item').forEach(n => {
        n.classList.toggle('active', n.getAttribute('data-view') === viewName);
    });
    
    updateAllUIs();
}

function updateAllUIs() {
    updateUserSwitcher();
    updateHomeUI();
    updateMyPageUI();
    renderInfoPosts();
    renderHelpRequests();
    checkIncomingResponses();
}

function updateUserSwitcher() {
    const switcher = document.getElementById('user-switcher');
    if (!switcher) return;
    
    switcher.innerHTML = Object.values(users).map(user => 
        `<option value="${user.id}">${user.name} (${user.city}, ${user.job})</option>`
    ).join('');
    
    if (currentUser) {
        switcher.value = currentUser.id;
    }
}

function updateHomeUI() {
    if (!currentUser) return;
    const ids = ['home-username', 'home-country', 'home-city', 'home-job'];
    const values = [currentUser.name, currentUser.country, currentUser.city, currentUser.job];
    ids.forEach((id, idx) => {
        const el = document.getElementById(id);
        if (el) el.textContent = values[idx] + (id === 'home-username' ? '님' : '');
    });
}

function updateMyPageUI() {
    if (!currentUser) return;
    const elName = document.getElementById('my-name');
    if (elName) elName.textContent = currentUser.name;
    const elTag = document.getElementById('my-tag');
    if (elTag) elTag.textContent = `${currentUser.country} · ${currentUser.city} · ${currentUser.job}`;
    const elDeun = document.getElementById('my-deundeun');
    if (elDeun) elDeun.textContent = `${currentUser.deundeunScore}점`;
    const elCredit = document.getElementById('my-credit');
    if (elCredit) elCredit.textContent = `${currentUser.helpCredit} CP`;
    
    renderHistory();
}

function renderHistory() {
    const container = document.getElementById('history-container');
    if (!container) return;
    if (!currentUser.history || currentUser.history.length === 0) {
        container.innerHTML = '<div class="no-history">활동 내역이 없습니다.</div>';
        return;
    }

    container.innerHTML = currentUser.history.map(h => {
        const isOngoing = h.status === 'ongoing';
        const isRequester = h.role === 'requester';
        
        let statusBadge = `<span class="history-status-badge ${isOngoing ? 'status-ongoing' : 'status-completed'}">${isOngoing ? '진행중' : '완료'}</span>`;
        let reviewBtn = (isOngoing && isRequester) ? `<button class="btn-review" onclick="openReviewModal(${h.id})">후기 작성</button>` : '';

        return `
            <div class="history-item">
                <div class="history-info">
                    ${statusBadge}
                    <span class="history-title">${h.type}</span>
                    <span class="history-date">${h.date}</span>
                </div>
                <div class="history-actions">
                    <span class="history-amount ${h.amount > 0 ? 'plus' : 'minus'}">${h.amount > 0 ? '+' : ''}${h.amount} CP</span>
                    ${reviewBtn}
                </div>
            </div>
        `;
    }).join('');
}

function renderInfoPosts() {
    const container = document.getElementById('info-posts-container');
    if (!container) return;
    if (infoPosts.length === 0) {
        container.innerHTML = '<div class="no-posts">첫 번째 꿀팁의 주인공이 되어보세요!</div>';
        return;
    }
    container.innerHTML = infoPosts.map(post => `
        <div class="info-card">
            <div class="info-card-header">
                <span class="info-badge">${post.country}</span>
                <span class="info-date">${post.date}</span>
            </div>
            <div class="info-card-body">
                <h3>${post.title}</h3>
                <p>${post.content}</p>
                <div style="margin-top: 8px; font-size: 0.8rem; font-weight: 600; color: var(--primary-color);">
                    작성자: ${post.author}
                </div>
            </div>
        </div>
    `).join('');
}

function renderHelpRequests() {
    const container = document.getElementById('help-list-container');
    if (!container) return;
    container.innerHTML = ''; // Clear first

    const filtered = helpRequests.filter(req => {
        if (req.status !== 'open') return false;
        if (req.country !== currentUser.country) return false;
        if (req.cityOnly && req.city !== currentUser.city) return false;
        return true;
    });

    if (filtered.length === 0) {
        container.innerHTML = '<div class="no-posts">현재 주변에 도움 요청이 없습니다.</div>';
        return;
    }

    container.innerHTML = filtered.map(req => {
        const isMyReq = req.authorId === currentUser.id;
        const isAlreadyResponded = req.responders && req.responders.some(r => r.id === currentUser.id);
        
        let actionBtn = isMyReq ? '<span class="info-badge">나의 요청</span>' 
                        : (isAlreadyResponded ? '<button class="btn btn-secondary btn-sm" disabled>대기중</button>' 
                        : `<button class="btn btn-primary-outline btn-sm" onclick="handleHelpResponse(${req.id})">도와줄게요!</button>`);

        return `
            <div class="help-card">
                <div class="help-card-header">
                    <span class="help-category-badge">${req.category}</span>
                    <span class="help-price"><i class="fa-solid fa-coins"></i> ${req.cost} CP</span>
                </div>
                <div class="help-title">${req.content}</div>
                <div class="help-footer">
                    <div class="help-meta">
                        <span class="user-info">${req.author} (${req.job})</span>
                        <span>든든 점수: <span class="text-heart">${req.deundeunScore}점</span></span>
                    </div>
                    ${actionBtn}
                </div>
            </div>
        `;
    }).join('');
}

function handleHelpResponse(requestId) {
    const req = helpRequests.find(r => r.id === requestId);
    if (!req) return;

    if (!req.responders) req.responders = [];
    req.responders.push({
        id: currentUser.id,
        name: currentUser.name,
        job: currentUser.job,
        deundeunScore: currentUser.deundeunScore
    });

    saveAllData();
    alert(`${req.author}님께 도움 의사를 전달했습니다!`);
    updateAllUIs();
}

function checkIncomingResponses() {
    const myReqWithResp = helpRequests.find(r => r.authorId === currentUser.id && r.status === 'open' && r.responders && r.responders.length > 0);
    if (myReqWithResp) {
        showResponseModal(myReqWithResp, myReqWithResp.responders[0]);
    }
}

function showResponseModal(request, responder) {
    const modal = document.getElementById('response-modal');
    const preview = document.getElementById('responder-profile-preview');
    
    preview.innerHTML = `
        <div class="help-meta">
            <span class="user-info" style="font-size: 1.1rem;">${responder.name} (${responder.job})</span>
            <span style="font-size: 0.9rem;">든든 점수: <span class="text-heart">${responder.deundeunScore}점</span></span>
        </div>
    `;

    document.getElementById('btn-accept-help').onclick = () => {
        acceptHelp(request, responder);
        modal.classList.remove('active');
    };

    document.getElementById('btn-decline-help').onclick = () => {
        request.responders.shift();
        saveAllData();
        modal.classList.remove('active');
        updateAllUIs();
    };

    document.getElementById('btn-close-response-modal').onclick = () => modal.classList.remove('active');
    modal.classList.add('active');
}

function acceptHelp(request, responder) {
    request.status = 'ongoing';
    request.acceptedResponderId = responder.id;

    const commonData = {
        id: request.id,
        type: request.category,
        date: new Date().toLocaleDateString(),
        status: 'ongoing',
        cost: request.cost
    };

    // Add to Requester History
    currentUser.history.unshift({
        ...commonData,
        role: 'requester',
        otherPartyId: responder.id,
        otherPartyName: responder.name,
        amount: -request.cost
    });

    // Add to Responder History
    const responderUser = users[responder.id];
    if (responderUser) {
        responderUser.history.unshift({
            ...commonData,
            role: 'responder',
            otherPartyId: currentUser.id,
            otherPartyName: currentUser.name,
            amount: request.cost
        });
    }

    saveAllData();
    alert(`${responder.name}님의 도움을 수락했습니다! 히스토리에서 진행 상황을 확인하세요.`);
    updateAllUIs();
}

function openReviewModal(historyId) {
    currentReviewingHistoryId = historyId;
    currentReviewRating = 0;
    document.querySelectorAll('.star-btn').forEach(s => s.classList.remove('active'));
    document.getElementById('review-comment').value = '';
    document.getElementById('review-modal').classList.add('active');
}

function completeReview(comment) {
    const historyItem = currentUser.history.find(h => h.id === currentReviewingHistoryId);
    if (!historyItem) return;

    const responderId = historyItem.otherPartyId;
    const responderUser = users[responderId];
    const cost = historyItem.cost;

    // 1. Update Status
    historyItem.status = 'completed';
    historyItem.rating = currentReviewRating;
    historyItem.comment = comment;

    if (responderUser) {
        const responderHistory = responderUser.history.find(h => h.id === historyItem.id);
        if (responderHistory) {
            responderHistory.status = 'completed';
            responderHistory.rating = currentReviewRating;
            responderHistory.comment = comment;
        }

        // 2. Transfer Credits
        responderUser.helpCredit += cost;

        // 3. Update Score
        if (currentReviewRating >= 4) responderUser.deundeunScore += 2;
        else if (currentReviewRating <= 2) responderUser.deundeunScore -= 5;
    }

    // 4. Update Request Status
    const request = helpRequests.find(r => r.id === historyItem.id);
    if (request) request.status = 'completed';

    document.getElementById('review-modal').classList.remove('active');
    saveAllData();
    updateAllUIs();
    alert('후기가 성공적으로 제출되었습니다! 도움을 준 분에게 크레딧과 점수가 반영되었습니다.');
}

window.goToOnboarding = function() {
    localStorage.removeItem('workommu_onboarded');
    checkOnboardingState();
};

window.deleteAccount = function() {
    if (!currentUser) {
        alert('삭제할 유저가 없습니다.');
        return;
    }
    if (confirm(`정말로 현재 계정(${currentUser.name})을 완전히 삭제하시겠습니까?\n이 계정의 크레딧, 든든 점수, 히스토리를 포함한 모든 데이터가 삭제됩니다.`)) {
        const deletedId = currentUser.id;
        delete users[deletedId];
        
        // Save users
        localStorage.setItem('workommu_users', JSON.stringify(users));

        const userKeys = Object.keys(users);
        if (userKeys.length > 0) {
            // Switch to the first available user
            currentUser = users[userKeys[0]];
            localStorage.setItem('workommu_current_user_id', currentUser.id);
            alert('계정이 삭제되었습니다. 다른 계정으로 전환합니다.');
            location.reload();
        } else {
            // No users left
            currentUser = null;
            localStorage.removeItem('workommu_current_user_id');
            localStorage.removeItem('workommu_onboarded');
            alert('계정이 삭제되었습니다. 계정이 없으므로 온보딩 화면으로 이동합니다.');
            location.reload();
        }
    }
};
