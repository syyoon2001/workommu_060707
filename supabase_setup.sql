-- 워코뮤 데이터베이스 테이블 생성 SQL
-- 기획서 기반 설계

-- 기존 테이블 삭제 (재실행을 위함)
DROP TABLE IF EXISTS safety_reports CASCADE;
DROP TABLE IF EXISTS help_history CASCADE;
DROP TABLE IF EXISTS help_responses CASCADE;
DROP TABLE IF EXISTS help_requests CASCADE;
DROP TABLE IF EXISTS info_posts CASCADE;
DROP TABLE IF EXISTS help_categories CASCADE;
DROP TABLE IF EXISTS profiles CASCADE;

-- 트리거 삭제
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user;
DROP FUNCTION IF EXISTS update_updated_at_column;

-- 1. 프로필 테이블 (auth.users와 1:1 관계)
CREATE TABLE profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    country VARCHAR(50) NOT NULL,
    city VARCHAR(100) NOT NULL,
    job VARCHAR(100) NOT NULL,
    help_credit INTEGER DEFAULT 10,
    deundeun_score INTEGER DEFAULT 30,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. 도움 카테고리 테이블
CREATE TABLE help_categories (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    credit_cost INTEGER NOT NULL,
    risk_level VARCHAR(20) NOT NULL, -- 'low', 'high', 'in_person'
    min_deundeun_score INTEGER DEFAULT 0,
    type VARCHAR(50) NOT NULL -- 'remote', 'item_transfer', 'in_person'
);

-- 3. 정보 게시글 테이블
CREATE TABLE info_posts (
    id SERIAL PRIMARY KEY,
    author_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    title VARCHAR(200) NOT NULL,
    content TEXT NOT NULL,
    country VARCHAR(50) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. 도움 요청 테이블
CREATE TABLE help_requests (
    id SERIAL PRIMARY KEY,
    author_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    category_id INTEGER NOT NULL REFERENCES help_categories(id),
    content TEXT NOT NULL,
    city_only BOOLEAN DEFAULT false,
    status VARCHAR(20) DEFAULT 'open', -- 'open', 'ongoing', 'completed', 'cancelled'
    cost INTEGER NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    accepted_responder_id UUID REFERENCES profiles(id) ON DELETE SET NULL
);

-- 5. 도움 응답 테이블
CREATE TABLE help_responses (
    id SERIAL PRIMARY KEY,
    help_request_id INTEGER NOT NULL REFERENCES help_requests(id) ON DELETE CASCADE,
    responder_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(help_request_id, responder_id)
);

-- 6. 도움 히스토리 테이블
CREATE TABLE help_history (
    id SERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    help_request_id INTEGER NOT NULL REFERENCES help_requests(id) ON DELETE CASCADE,
    role VARCHAR(20) NOT NULL, -- 'requester', 'responder'
    status VARCHAR(20) DEFAULT 'ongoing', -- 'ongoing', 'completed'
    amount INTEGER NOT NULL, -- 크레딧 변동량 (+/-)
    rating INTEGER CHECK (rating >= 1 AND rating <= 5),
    comment TEXT,
    other_party_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    other_party_name VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 7. 신고 테이블 (안전 장치)
CREATE TABLE safety_reports (
    id SERIAL PRIMARY KEY,
    reporter_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    reported_user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    help_request_id INTEGER REFERENCES help_requests(id) ON DELETE SET NULL,
    reason TEXT NOT NULL,
    status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'reviewed', 'resolved'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 인덱스 생성 (성능 최적화)
CREATE INDEX idx_info_posts_author ON info_posts(author_id);
CREATE INDEX idx_info_posts_country ON info_posts(country);
CREATE INDEX idx_help_requests_author ON help_requests(author_id);
CREATE INDEX idx_help_requests_status ON help_requests(status);
CREATE INDEX idx_help_requests_category ON help_requests(category_id);
CREATE INDEX idx_help_responses_request ON help_responses(help_request_id);
CREATE INDEX idx_help_responses_responder ON help_responses(responder_id);
CREATE INDEX idx_help_history_user ON help_history(user_id);
CREATE INDEX idx_help_history_request ON help_history(help_request_id);
CREATE INDEX idx_safety_reports_reported ON safety_reports(reported_user_id);

-- RLS (Row Level Security) 정책 활성화
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE info_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE help_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE help_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE help_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE safety_reports ENABLE ROW LEVEL SECURITY;

-- Profiles 테이블 RLS 정책
CREATE POLICY "Users can view all profiles" ON profiles FOR SELECT USING (true);
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE USING (auth.uid() = id);

-- Info Posts 테이블 RLS 정책
CREATE POLICY "Anyone can view info posts" ON info_posts FOR SELECT USING (true);
CREATE POLICY "Authenticated users can create posts" ON info_posts FOR INSERT WITH CHECK (auth.uid() = author_id);
CREATE POLICY "Users can update own posts" ON info_posts FOR UPDATE USING (auth.uid() = author_id);
CREATE POLICY "Users can delete own posts" ON info_posts FOR DELETE USING (auth.uid() = author_id);

-- Help Requests 테이블 RLS 정책
CREATE POLICY "Anyone can view help requests" ON help_requests FOR SELECT USING (true);
CREATE POLICY "Authenticated users can create requests" ON help_requests FOR INSERT WITH CHECK (auth.uid() = author_id);
CREATE POLICY "Users can update own requests" ON help_requests FOR UPDATE USING (auth.uid() = author_id);

-- Help Responses 테이블 RLS 정책
CREATE POLICY "Anyone can view help responses" ON help_responses FOR SELECT USING (true);
CREATE POLICY "Authenticated users can create responses" ON help_responses FOR INSERT WITH CHECK (auth.uid() = responder_id);

-- Help History 테이블 RLS 정책
CREATE POLICY "Users can view own history" ON help_history FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "System can create history" ON help_history FOR INSERT WITH CHECK (true);
CREATE POLICY "System can update history" ON help_history FOR UPDATE WITH CHECK (true);

-- Safety Reports 테이블 RLS 정책
CREATE POLICY "Users can create reports" ON safety_reports FOR INSERT WITH CHECK (auth.uid() = reporter_id);
CREATE POLICY "Users can view own reports" ON safety_reports FOR SELECT USING (auth.uid() = reporter_id);

-- 트리거: updated_at 자동 업데이트
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON profiles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_help_history_updated_at BEFORE UPDATE ON help_history
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 프로필 자동 생성 트리거 (auth.users 생성 시)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, name, country, city, job, help_credit, deundeun_score)
    VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'name', 'Unknown'),
        COALESCE(NEW.raw_user_meta_data->>'country', '호주'),
        COALESCE(NEW.raw_user_meta_data->>'city', '시드니'),
        COALESCE(NEW.raw_user_meta_data->>'job', '아직 잘 모르겠음'),
        10,
        30
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 초기 데이터: 도움 카테고리
INSERT INTO help_categories (name, credit_cost, risk_level, min_deundeun_score, type) VALUES
('정보 제공', 1, 'low', 0, 'remote'),
('일자리 소개(레퍼럴)', 2, 'low', 0, 'remote'),
('룸메이트·셰어하우스 연결', 2, 'low', 0, 'remote'),
('전화 대리/동행', 1, 'low', 0, 'remote'),
('생활용품 나눔', 1, 'low', 0, 'item_transfer'),
('집 양도', 3, 'high', 40, 'item_transfer'),
('중고차 매매', 3, 'high', 40, 'item_transfer'),
('이사 도움', 2, 'high', 40, 'in_person'),
('공항 픽업/마중', 2, 'high', 40, 'in_person'),
('계좌 개설 동행', 2, 'high', 40, 'in_person'),
('병원 동행', 3, 'high', 40, 'in_person');
