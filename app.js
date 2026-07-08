const cityData = {
    '호주': ['시드니', '브리즈번', '멜버른'],
    '캐나다': ['밴쿠버', '토론토', '캘거리'],
    '일본': ['도쿄', '오사카', '교토']
};

function getDefaultUsers() {
    return {};
}

let supabaseClient = null;
let currentAuthUser = null;
let users = {};
let currentUser = null;
let helpRequests = [];
let infoPosts = [];
let currentReviewingHistoryId = null;
let currentReviewRating = 0;

document.addEventListener('DOMContentLoaded', () => {
    initApp();
});

async function initApp() {
    initSupabase();
    initData();
    setupEventListeners();
    setupAuthListeners();
    await checkAppState();
}

function initSupabase() {
    const config = window.SUPABASE_CONFIG;
    if (!config?.url || !config?.publishableKey) {
        showAuthMessage('Supabase 설정이 없습니다. config.example.js를 config.js로 복사해주세요.', 'error');
        return;
    }
    supabaseClient = supabase.createClient(config.url, config.publishableKey);
}

function getOnboardedKey(userId) {
    return `workommu_onboarded_${userId}`;
}

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

    // Load Current User ID (set after auth in checkAppState)
    const savedUserId = localStorage.getItem('workommu_current_user_id');
    if (savedUserId && users[savedUserId]) {
        currentUser = users[savedUserId];
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

function hideAllScreens() {
    ['auth-screen', 'onboarding-screen'].forEach(id => {
        const el = document.getElementById(id);
        el.classList.add('hidden');
        el.classList.remove('active');
    });
    document.getElementById('main-content').classList.add('hidden');
    document.getElementById('bottom-nav').classList.add('hidden');
    document.getElementById('app-header').classList.add('hidden');
}

async function checkAppState() {
    if (!supabaseClient) {
        hideAllScreens();
        const authScreen = document.getElementById('auth-screen');
        authScreen.classList.remove('hidden');
        authScreen.classList.add('active');
        return;
    }

    hideAllScreens();

    const { data: { session } } = await supabaseClient.auth.getSession();
    currentAuthUser = session?.user ?? null;

    const authScreen = document.getElementById('auth-screen');
    const onboarding = document.getElementById('onboarding-screen');
    const main = document.getElementById('main-content');
    const nav = document.getElementById('bottom-nav');
    const header = document.getElementById('app-header');

    if (!currentAuthUser) {
        authScreen.classList.remove('hidden');
        authScreen.classList.add('active');
        return;
    }

    currentUser = users[currentAuthUser.id] ?? null;
    const onboarded = localStorage.getItem(getOnboardedKey(currentAuthUser.id)) === 'true';

    if (!onboarded || !currentUser) {
        onboarding.classList.remove('hidden');
        onboarding.classList.add('active');
        return;
    }

    localStorage.setItem('workommu_current_user_id', currentUser.id);
    main.classList.remove('hidden');
    nav.classList.remove('hidden');
    header.classList.remove('hidden');

    updateAllUIs();
}

function setupAuthListeners() {
    document.querySelectorAll('.auth-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            switchAuthTab(tab.dataset.authTab);
        });
    });

    const loginForm = document.getElementById('login-form');
    const signupForm = document.getElementById('signup-form');
    if (loginForm) loginForm.addEventListener('submit', handleLogin);
    if (signupForm) signupForm.addEventListener('submit', handleSignup);
}

function switchAuthTab(tabName) {
    document.querySelectorAll('.auth-tab').forEach(btn => {
        const isActive = btn.dataset.authTab === tabName;
        btn.classList.toggle('active', isActive);
        btn.setAttribute('aria-selected', isActive);
    });

    document.getElementById('auth-login-panel').classList.toggle('active', tabName === 'login');
    document.getElementById('auth-signup-panel').classList.toggle('active', tabName === 'signup');
    clearAuthMessage();
}

function showAuthMessage(message, type = 'error') {
    const el = document.getElementById('auth-message');
    if (!el) return;
    el.textContent = message;
    el.classList.remove('hidden', 'error', 'success');
    el.classList.add(type);
}

function clearAuthMessage() {
    const el = document.getElementById('auth-message');
    if (!el) return;
    el.textContent = '';
    el.classList.add('hidden');
    el.classList.remove('error', 'success');
}

function translateAuthError(error) {
    const msg = error?.message || '';
    if (msg.includes('Invalid login credentials')) return '이메일 또는 비밀번호가 올바르지 않습니다.';
    if (msg.includes('User already registered')) return '이미 가입된 이메일입니다.';
    if (msg.includes('Password should be at least')) return '비밀번호는 8자 이상이어야 합니다.';
    if (msg.includes('Unable to validate email address')) return '올바른 이메일 주소를 입력해주세요.';
    return msg || '오류가 발생했습니다. 다시 시도해주세요.';
}

async function handleLogin(e) {
    e.preventDefault();
    if (!supabaseClient) return;

    const email = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-password').value;
    const btn = document.getElementById('btn-login');
    btn.disabled = true;

    const { error } = await supabaseClient.auth.signInWithPassword({ email, password });
    btn.disabled = false;

    if (error) {
        showAuthMessage(translateAuthError(error), 'error');
        return;
    }

    clearAuthMessage();
    await checkAppState();
}

async function handleSignup(e) {
    e.preventDefault();
    if (!supabaseClient) return;

    const email = document.getElementById('signup-email').value.trim();
    const password = document.getElementById('signup-password').value;
    const confirm = document.getElementById('signup-password-confirm').value;

    if (password !== confirm) {
        showAuthMessage('비밀번호가 일치하지 않습니다.', 'error');
        return;
    }

    const btn = document.getElementById('btn-signup');
    btn.disabled = true;

    const { data, error } = await supabaseClient.auth.signUp({ email, password });
    btn.disabled = false;

    if (error) {
        showAuthMessage(translateAuthError(error), 'error');
        return;
    }

    if (data.session) {
        clearAuthMessage();
        await checkAppState();
        return;
    }

    showAuthMessage('회원가입이 완료되었습니다. 이메일 인증 후 로그인해주세요.', 'success');
    switchAuthTab('login');
}

function checkOnboardingState() {
    checkAppState();
}

function setupEventListeners() {
    const infoPostForm = document.getElementById('info-post-form');
    const btnOpenHelp = document.getElementById('btn-open-help-modal');
    const btnCloseHelp = document.getElementById('btn-close-help-modal');
    const helpModal = document.getElementById('help-modal');
    const helpRequestForm = document.getElementById('help-request-form');

    // Dev Panel Toggle (시연/테스트 전용)
    const btnToggleDevPanel = document.getElementById('btn-toggle-dev-panel');
    if (btnToggleDevPanel) {
        btnToggleDevPanel.addEventListener('click', () => {
            const panel = document.getElementById('dev-panel');
            const isOpen = panel.classList.toggle('open');
            btnToggleDevPanel.setAttribute('aria-expanded', String(isOpen));
            const icon = btnToggleDevPanel.querySelector('i');
            icon.classList.toggle('fa-chevron-left', !isOpen);
            icon.classList.toggle('fa-chevron-right', isOpen);
        });
    }

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
            alert('글이 등록되었습니다! 1 C를 획득하셨습니다.');
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
            if (!currentAuthUser) {
                alert('로그인이 필요합니다.');
                return;
            }

            const name = document.getElementById('user-name').value;
            const country = document.getElementById('user-country').value;
            const city = document.getElementById('user-city').value;
            const job = document.getElementById('user-job').value;

            const newUserId = currentAuthUser.id;
            const newUser = {
                id: newUserId,
                email: currentAuthUser.email,
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

            localStorage.setItem(getOnboardedKey(currentAuthUser.id), 'true');
            saveAllData();

            onboardingForm.reset();
            checkAppState();
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
    updateHomeUI();
    updateMyPageUI();
    renderInfoPosts();
    renderHelpRequests();
    checkIncomingResponses();
}

function updateHomeUI() {
    if (!currentUser) return;
    const ids = ['home-username', 'home-country', 'home-city', 'home-job'];
    const values = [currentUser.name, currentUser.country, currentUser.city, currentUser.job];
    ids.forEach((id, idx) => {
        const el = document.getElementById(id);
        if (el) el.textContent = values[idx];
    });
}

function updateMyPageUI() {
    if (!currentUser) return;
    const elName = document.getElementById('my-name');
    if (elName) elName.textContent = currentUser.name;
    const elTag = document.getElementById('my-tag');
    if (elTag) elTag.textContent = `${currentUser.country} ${currentUser.city} · ${currentUser.job}`;
    const elDeun = document.getElementById('my-deundeun');
    if (elDeun) elDeun.textContent = `${currentUser.deundeunScore}점`;
    const elCredit = document.getElementById('my-credit');
    if (elCredit) elCredit.textContent = `${currentUser.helpCredit} C`;
    
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
                    <span class="history-amount ${h.amount > 0 ? 'plus' : 'minus'}">${h.amount > 0 ? '+' : ''}${h.amount} C</span>
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
                    <span class="help-price"><i class="fa-solid fa-coins"></i> ${req.cost} C</span>
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
    if (currentAuthUser) {
        localStorage.removeItem(getOnboardedKey(currentAuthUser.id));
    }
    checkAppState();
};

window.logout = async function() {
    if (!supabaseClient) return;
    await supabaseClient.auth.signOut();
    currentUser = null;
    currentAuthUser = null;
    switchAuthTab('login');
    document.getElementById('login-form')?.reset();
    document.getElementById('signup-form')?.reset();
    await checkAppState();
};

window.deleteAccount = async function() {
    if (!currentUser || !currentAuthUser) {
        alert('삭제할 계정이 없습니다.');
        return;
    }
    if (!confirm(`정말로 현재 계정(${currentUser.name})을 완전히 삭제하시겠습니까?\n프로필, 크레딧, 든든 점수, 도움 히스토리는 물론 로그인 계정 자체도 영구 삭제되며 되돌릴 수 없습니다.`)) {
        return;
    }

    const btn = document.getElementById('btn-delete-account');
    if (btn) btn.disabled = true;

    try {
        const { error } = await supabaseClient.functions.invoke('delete-account');

        if (error) {
            let message = error.message;
            try {
                const body = await error.context.json();
                if (body?.error) message = body.error;
            } catch (_) { /* keep default message */ }
            console.error('계정 삭제 실패:', error);
            alert('계정 삭제 중 오류가 발생했습니다: ' + message);
            return;
        }

        const deletedId = currentAuthUser.id;
        delete users[deletedId];
        localStorage.removeItem(getOnboardedKey(deletedId));
        localStorage.removeItem('workommu_current_user_id');
        localStorage.setItem('workommu_users', JSON.stringify(users));

        currentUser = null;
        currentAuthUser = null;
        await supabaseClient.auth.signOut();

        alert('계정이 완전히 삭제되었습니다. 로그인 화면으로 이동합니다.');
        switchAuthTab('login');
        await checkAppState();
    } catch (err) {
        console.error('계정 삭제 중 알 수 없는 오류 발생:', err);
        alert('계정 삭제 중 오류가 발생했습니다: ' + err.message);
    } finally {
        if (btn) btn.disabled = false;
    }
};

window.clearBoards = async function() {
    if (!currentUser) {
        alert('로그인이 필요한 서비스입니다.');
        return;
    }

    if (confirm('정말로 정보 게시판과 도움 게시판의 모든 글을 삭제하시겠습니까?\n이 작업은 되돌릴 수 없으며, Supabase 데이터베이스와 화면의 목록이 즉시 초기화됩니다.\n(프로필, 크레딧, 든든 점수, 도움 히스토리는 안전하게 유지됩니다)')) {
        try {
            // 1. Supabase에서 정보 게시판(info_posts)과 도움 게시판(help_requests)의 모든 데이터 삭제
            // RLS DELETE 정책이 "본인 글만" 삭제를 허용하므로, 전체 삭제는 SECURITY DEFINER RPC를 통해 수행한다.
            if (supabaseClient) {
                const { error: clearError } = await supabaseClient.rpc('clear_boards');

                if (clearError) {
                    console.error('Supabase 게시판 초기화 실패:', clearError);
                    alert('게시판 데이터 삭제 중 오류가 발생했습니다: ' + clearError.message);
                    return;
                }
            }

            // 2. 로컬 메모리 초기화
            infoPosts = [];
            helpRequests = [];

            // 3. 로컬 스토리지 데이터 동기화 및 저장
            saveAllData();

            // 4. 즉시 화면 갱신
            updateAllUIs();

            alert('게시판 초기화가 완료되었습니다. Supabase 데이터베이스와 로컬 데이터가 모두 삭제되었습니다.');
        } catch (err) {
            console.error('초기화 작업 중 알 수 없는 오류 발생:', err);
            alert('초기화 중 오류가 발생했습니다: ' + err.message);
        }
    }
};

