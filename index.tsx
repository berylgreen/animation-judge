import React, { useState, useRef } from "react";
import ReactDOM from "react-dom/client";
import { GoogleGenAI, Type } from "@google/genai";

// Icons
const UploadIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
    <polyline points="17 8 12 3 7 8"></polyline>
    <line x1="12" y1="3" x2="12" y2="15"></line>
  </svg>
);

const VideoIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="23 7 16 12 23 17 23 7"></polygon>
    <rect x="1" y="5" width="15" height="14" rx="2" ry="2"></rect>
  </svg>
);

const LoaderIcon = () => (
  <svg className="animate-spin" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 12a9 9 0 1 1-6.219-8.56"></path>
  </svg>
);

const FileIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"></path>
    <polyline points="13 2 13 9 20 9"></polyline>
  </svg>
);

// Types
interface GradingCategory {
  name: string;
  score: number;
  maxScore: number; // Changed from weight to maxScore for clearer display (e.g. 18/20)
  feedback: string;
}

interface GradingResult {
  overallScore: number;
  studentNameGuess?: string;
  summary: string;
  categories: GradingCategory[];
}

const App = () => {
  const [file, setFile] = useState<File | null>(null);
  const [mediaPreview, setMediaPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<GradingResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      processFile(e.target.files[0]);
    }
  };

  const processFile = (selectedFile: File) => {
    // Basic client-side size check (20MB soft limit for stability with inline base64)
    if (selectedFile.size > 20 * 1024 * 1024) {
      setError("文件过大。为了演示稳定性，请上传 20MB 以内的文件。");
      return;
    }

    setFile(selectedFile);
    setError(null);
    setResult(null);
    
    const reader = new FileReader();
    reader.onloadend = () => {
      setMediaPreview(reader.result as string);
    };
    reader.readAsDataURL(selectedFile);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const analyzeWork = async () => {
    if (!mediaPreview || !file) return;

    setLoading(true);
    setError(null);

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      
      const base64Data = mediaPreview.split(',')[1];
      const mimeType = file.type;
      
      // Prompt optimized for the 8 specific grading criteria
      const prompt = `
        角色设定：你是一位大学《计算机三维动画设计》课程的专业教师。
        任务：请对学生提交的期末作业进行严格的学术打分。
        
        当前提交的文件名：${file.name}
        
        请严格按照以下 8 个评分项进行打分（总分 100 分）：
        
        1. 主题内容 (10分)：
           - 检查内容是否健康向上，主题是否明确，故事表达是否完整。
        
        2. 模型要求 (10分)：
           - 检查模型细节适中程度，比例是否准确。
           - 检查材质贴图是否完整，UV展开是否合理。
           
        3. 动画技术 (20分)：
           - 区分基础要求（关键帧动画）与提高要求（IK/骨骼/修改器动画）。
           - 技术实现难度判定。
           
        4. 运动规律 (20分)：
           - 核心考察项。是否符合物理规律（重力、惯性）。
           - 是否体现动画法则：挤压拉伸、预备动作、缓冲曲线 (Ease in/out)、跟随动作等。
           
        5. 工作量 (10分)：
           - 根据视频估算场景丰富度、模型数量及动画时长（通常要求15秒以上）。
           
        6. 渲染输出 (10分)：
           - 检查画面分辨率、清晰度。
           - 是否有噪点、闪烁或锯齿。
           
        7. 综合视觉 (10分)：
           - 构图美观度、色彩搭配和谐度、整体艺术风格。
           
        8. 提交规范 (10分)：
           - 必须严格检查文件名是否符合格式："完整学号_姓名_作品名" (例如: 22305011_张三_期末作业.mp4)。
           - 如果文件名缺少学号或姓名，此项应扣分。

        请用中文回复。
        【重要】：所有打分（包括总分和分项分）必须严格为整数 (Integer)，禁止出现小数。
        评语中请包含专业的 3ds Max 术语（如 Curve Editor, UVW Unwrap, Keyframes, Modifier Stack 等）。
        如果文件名不规范，请在“提交规范”的评语中明确指出。
      `;

      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: {
          parts: [
            {
              inlineData: {
                data: base64Data,
                mimeType: mimeType
              }
            },
            {
              text: prompt
            }
          ]
        },
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              overallScore: { type: Type.INTEGER, description: "Total score (integer only)" },
              studentNameGuess: { type: Type.STRING, description: "Extracted name from filename if present, or generic '同学'" },
              summary: { type: Type.STRING },
              categories: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    name: { type: Type.STRING },
                    score: { type: Type.INTEGER, description: "Actual score earned for this category (integer only)" },
                    maxScore: { type: Type.INTEGER, description: "Maximum possible score for this category (e.g. 10 or 20)" },
                    feedback: { type: Type.STRING }
                  },
                  required: ["name", "score", "maxScore", "feedback"]
                }
              }
            },
            required: ["overallScore", "summary", "categories"]
          }
        }
      });

      const text = response.text;
      if (text) {
        setResult(JSON.parse(text));
      } else {
        throw new Error("No data returned from AI");
      }

    } catch (err: any) {
      console.error(err);
      setError("分析失败，请检查网络或文件格式。");
    } finally {
      setLoading(false);
    }
  };

  const getScoreColor = (score: number, max: number = 100) => {
    const percentage = (score / max) * 100;
    if (percentage >= 90) return "#4caf50"; // A
    if (percentage >= 80) return "#8bc34a"; // B
    if (percentage >= 70) return "#ffc107"; // C
    if (percentage >= 60) return "#ff9800"; // D
    return "#f44336"; // F
  };

  const getGradeLabel = (score: number) => {
    if (score >= 90) return 'A (优秀)';
    if (score >= 80) return 'B (良好)';
    if (score >= 70) return 'C (中等)';
    if (score >= 60) return 'D (及格)';
    return 'F (不及格)';
  };

  const isVideo = file?.type.startsWith('video/');

  return (
    <div className="container">
      <header className="header">
        <div className="logo">
          <span className="logo-icon">MAX</span>
          <h1>3ds Max 作业批改系统</h1>
        </div>
        <p className="subtitle">计算机三维动画设计 · 期末作品评分标准 (A)</p>
      </header>

      <main className="main-content">
        <div className="left-panel">
          <div 
            className={`upload-zone ${!mediaPreview ? 'empty' : ''}`}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
            onClick={() => !mediaPreview && fileInputRef.current?.click()}
          >
            <input 
              type="file" 
              ref={fileInputRef} 
              onChange={handleFileChange} 
              accept="image/*,video/*" 
              style={{ display: 'none' }} 
            />
            
            {mediaPreview ? (
              <div className="preview-container">
                {isVideo ? (
                  <video 
                    src={mediaPreview} 
                    className="preview-media" 
                    controls 
                    autoPlay 
                    loop 
                    muted 
                  />
                ) : (
                  <img src={mediaPreview} alt="Student Work" className="preview-media" />
                )}
                
                <div className="file-info-overlay">
                   <FileIcon />
                   <span className="filename">{file?.name}</span>
                </div>

                <button 
                  className="change-image-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    fileInputRef.current?.click();
                  }}
                >
                  更换作业
                </button>
              </div>
            ) : (
              <div className="upload-placeholder">
                <div className="icons-row">
                    <UploadIcon />
                    <VideoIcon />
                </div>
                <h3>上传期末作品 (MP4)</h3>
                <p>系统将按照 8 项标准自动评分</p>
                <span className="upload-hint">文件命名：完整学号_姓名_作品名.mp4</span>
              </div>
            )}
          </div>

          <div className="actions">
            <button 
              className="analyze-btn" 
              onClick={analyzeWork}
              disabled={!mediaPreview || loading}
            >
              {loading ? (
                <>
                  <span className="spinner"><LoaderIcon /></span>
                  <span>正在检测运动规律与规范...</span>
                </>
              ) : (
                "开始评分"
              )}
            </button>
            {error && <div className="error-message">{error}</div>}
          </div>
        </div>

        <div className="right-panel">
          {!result ? (
            <div className="empty-state">
              <div className="empty-content">
                <h3>等待评分</h3>
                <p>请上传学生作业。评分标准如下：</p>
                <div className="criteria-list">
                  <div className="criteria-item">主题内容 (10)</div>
                  <div className="criteria-item">模型要求 (10)</div>
                  <div className="criteria-item">动画技术 (20)</div>
                  <div className="criteria-item">运动规律 (20)</div>
                  <div className="criteria-item">工作量 (10)</div>
                  <div className="criteria-item">渲染输出 (10)</div>
                  <div className="criteria-item">综合视觉 (10)</div>
                  <div className="criteria-item">提交规范 (10)</div>
                </div>
              </div>
            </div>
          ) : (
            <div className="report-card">
              <div className="report-header">
                <div>
                  <h2 className="student-title">
                    {result.studentNameGuess ? result.studentNameGuess : "学生作业"} 
                    {isVideo && <span className="tag-video">Animation</span>}
                  </h2>
                  <div className="file-meta">{file?.name}</div>
                </div>
                <div className="total-score-box">
                  <div className="score-circle" style={{ borderColor: getScoreColor(Math.round(result.overallScore)) }}>
                    <span className="score-value" style={{ color: getScoreColor(Math.round(result.overallScore)) }}>
                      {Math.round(result.overallScore)}
                    </span>
                  </div>
                  <span className="grade-label" style={{ color: getScoreColor(Math.round(result.overallScore)) }}>
                    {getGradeLabel(Math.round(result.overallScore))}
                  </span>
                </div>
              </div>

              <div className="overall-summary">
                <strong>教师综合评语：</strong>
                {result.summary}
              </div>

              <div className="categories-grid">
                {result.categories.map((cat, idx) => (
                  <div key={idx} className="category-card">
                    <div className="category-header">
                      <h4>{cat.name}</h4>
                      <div className="category-score-display">
                        <span className="cat-score-val" style={{ color: getScoreColor(cat.score, cat.maxScore) }}>
                          {Math.round(cat.score)}
                        </span>
                        <span className="cat-score-total"> / {cat.maxScore}</span>
                      </div>
                    </div>
                    
                    <div className="progress-bg">
                      <div 
                        className="progress-fill" 
                        style={{ 
                          width: `${(Math.round(cat.score) / cat.maxScore) * 100}%`,
                          backgroundColor: getScoreColor(cat.score, cat.maxScore)
                        }}
                      ></div>
                    </div>
                    
                    <p className="category-feedback">{cat.feedback}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </main>

      <style>{`
        :root {
          --bg-dark: #121212;
          --bg-card: #1e1e1e;
          --bg-panel: #252525;
          --primary: #00bcd4;
          --accent: #ffb74d;
          --text-main: #e0e0e0;
          --text-muted: #a0a0a0;
          --border: #333;
        }

        .container {
          max-width: 1600px;
          margin: 0 auto;
          padding: 2rem;
          height: 100vh;
          box-sizing: border-box;
          display: flex;
          flex-direction: column;
        }

        .header {
          margin-bottom: 1.5rem;
          display: flex;
          align-items: baseline;
          gap: 1rem;
        }

        .logo {
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }

        .logo-icon {
          background: var(--primary);
          color: #000;
          font-weight: 900;
          padding: 4px 10px;
          border-radius: 4px;
          font-size: 1.2rem;
          letter-spacing: 1px;
        }

        h1 {
          margin: 0;
          font-size: 1.5rem;
          font-weight: 600;
        }

        .subtitle {
          margin: 0;
          color: var(--text-muted);
          font-size: 0.9rem;
          border-left: 1px solid var(--border);
          padding-left: 1rem;
        }

        .main-content {
          display: grid;
          grid-template-columns: 45% 55%;
          gap: 2rem;
          flex: 1;
          min-height: 0;
        }

        .left-panel {
          display: flex;
          flex-direction: column;
          gap: 1.5rem;
        }

        .upload-zone {
          flex: 1;
          background: var(--bg-card);
          border: 2px dashed var(--border);
          border-radius: 12px;
          overflow: hidden;
          position: relative;
          transition: all 0.3s ease;
          display: flex;
          flex-direction: column;
        }

        .upload-zone.empty {
          cursor: pointer;
          align-items: center;
          justify-content: center;
        }

        .upload-zone.empty:hover {
          border-color: var(--primary);
          background: var(--bg-panel);
        }

        .upload-placeholder {
          text-align: center;
          color: var(--text-muted);
          display: flex;
          flex-direction: column;
          align-items: center;
        }
        
        .icons-row {
            display: flex;
            gap: 1rem;
            margin-bottom: 1rem;
            color: var(--primary);
        }

        .upload-hint {
          display: block;
          font-size: 0.8rem;
          margin-top: 0.8rem;
          color: var(--accent);
          background: rgba(255, 183, 77, 0.1);
          padding: 4px 12px;
          border-radius: 20px;
        }

        .preview-container {
          width: 100%;
          height: 100%;
          background: #000;
          display: flex;
          align-items: center;
          justify-content: center;
          position: relative;
        }

        .preview-media {
          max-width: 100%;
          max-height: 100%;
          object-fit: contain;
        }

        .file-info-overlay {
          position: absolute;
          top: 1rem;
          left: 1rem;
          background: rgba(0, 0, 0, 0.6);
          backdrop-filter: blur(4px);
          padding: 6px 12px;
          border-radius: 6px;
          display: flex;
          align-items: center;
          gap: 8px;
          color: #fff;
          font-size: 0.85rem;
          max-width: 80%;
        }
        
        .filename {
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .change-image-btn {
          position: absolute;
          bottom: 1rem;
          right: 1rem;
          background: rgba(0,0,0,0.7);
          color: white;
          border: 1px solid rgba(255,255,255,0.2);
          padding: 0.5rem 1rem;
          border-radius: 6px;
          cursor: pointer;
          backdrop-filter: blur(4px);
          z-index: 10;
        }

        .actions {
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }

        .analyze-btn {
          background: linear-gradient(135deg, var(--primary), #00acc1);
          color: #000;
          border: none;
          padding: 1rem;
          font-size: 1.1rem;
          font-weight: 700;
          border-radius: 8px;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.5rem;
          transition: all 0.2s;
          box-shadow: 0 4px 12px rgba(0, 188, 212, 0.2);
        }

        .analyze-btn:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 6px 16px rgba(0, 188, 212, 0.3);
        }

        .analyze-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
          background: var(--bg-panel);
          color: var(--text-muted);
          box-shadow: none;
        }

        .error-message {
          color: #f44336;
          text-align: center;
          font-size: 0.9rem;
          background: rgba(244, 67, 54, 0.1);
          padding: 0.5rem;
          border-radius: 4px;
        }

        .right-panel {
          background: var(--bg-card);
          border-radius: 12px;
          overflow-y: auto;
          border: 1px solid var(--border);
          padding: 0;
        }

        .empty-state {
          height: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          color: var(--text-muted);
          text-align: center;
          padding: 2rem;
        }

        .criteria-list {
          display: flex;
          gap: 0.8rem;
          justify-content: center;
          margin-top: 1.5rem;
          flex-wrap: wrap;
          max-width: 600px;
        }

        .criteria-item {
          background: var(--bg-panel);
          padding: 6px 16px;
          border-radius: 100px;
          font-size: 0.85rem;
          border: 1px solid var(--border);
          color: var(--text-main);
        }

        .report-card {
          padding: 2rem;
        }

        .report-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 2rem;
          padding-bottom: 1.5rem;
          border-bottom: 1px solid var(--border);
        }

        .student-title {
          margin: 0 0 0.5rem 0;
          font-size: 1.8rem;
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .file-meta {
          color: var(--text-muted);
          font-family: monospace;
          font-size: 0.9rem;
        }

        .tag-video {
            background: var(--accent);
            color: #000;
            font-size: 0.7rem;
            padding: 2px 8px;
            border-radius: 4px;
            font-weight: 800;
            text-transform: uppercase;
            vertical-align: middle;
        }

        .total-score-box {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 0.5rem;
        }

        .score-circle {
          width: 80px;
          height: 80px;
          border-radius: 50%;
          border: 4px solid;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .score-value {
          font-size: 2.2rem;
          font-weight: 800;
        }

        .grade-label {
          font-size: 1rem;
          font-weight: 600;
        }

        .overall-summary {
          font-size: 1.05rem;
          line-height: 1.7;
          margin-bottom: 2rem;
          padding: 1.5rem;
          background: rgba(0, 188, 212, 0.05);
          border-radius: 8px;
          border-left: 4px solid var(--primary);
          color: #ddd;
        }

        .overall-summary strong {
          color: var(--primary);
          display: block;
          margin-bottom: 0.5rem;
        }

        .categories-grid {
          display: flex;
          flex-direction: column;
          gap: 1.5rem;
        }

        .category-card {
          background: var(--bg-panel);
          padding: 1.5rem;
          border-radius: 10px;
          border: 1px solid transparent;
          transition: border-color 0.2s;
        }
        
        .category-card:hover {
            border-color: rgba(255,255,255,0.1);
        }

        .category-header {
          display: flex;
          justify-content: space-between;
          margin-bottom: 0.8rem;
          align-items: center;
        }

        .category-header h4 {
          margin: 0;
          font-size: 1.1rem;
          font-weight: 600;
          color: var(--text-main);
        }

        .category-score-display {
          font-family: monospace;
          font-size: 1.1rem;
        }

        .cat-score-val {
          font-weight: 700;
        }
        
        .cat-score-total {
          color: var(--text-muted);
          font-size: 0.9rem;
        }

        .progress-bg {
          height: 8px;
          background: rgba(0,0,0,0.3);
          border-radius: 4px;
          margin-bottom: 0.8rem;
          overflow: hidden;
        }

        .progress-fill {
          height: 100%;
          border-radius: 4px;
          transition: width 1s ease-out;
        }

        .category-feedback {
          margin: 0;
          font-size: 0.95rem;
          color: #ccc;
          line-height: 1.6;
        }

        .animate-spin {
          animation: spin 1s linear infinite;
        }

        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }

        @media (max-width: 1024px) {
          .main-content {
            grid-template-columns: 1fr;
            min-height: auto;
          }
          
          .container {
            height: auto;
          }

          .upload-zone {
            min-height: 350px;
          }
        }
      `}</style>
    </div>
  );
};

const root = ReactDOM.createRoot(document.getElementById("root")!);
root.render(<App />);