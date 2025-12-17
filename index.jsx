import React, { useState, useEffect, useRef } from 'react';
import { Home, Search, Heart, User, Clock, BookOpen, Star, Sparkles, ChevronRight, Plus, X, Wand2, ArrowLeft, Share2, Volume2, StopCircle, LogOut, Globe, Brain, CheckCircle2, XCircle } from 'lucide-react';

// --- FIREBASE IMPORTS ---
import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, collection, onSnapshot, query } from 'firebase/firestore';

// --- YOUR SPECIFIC FIREBASE KEYS ---
const firebaseConfig = {
  apiKey: "AIzaSyDbH7IC-KYeOHQdudery0foQgeH04mkmX4",
  authDomain: "apna-toon-stories-app.firebaseapp.com",
  projectId: "apna-toon-stories-app",
  storageBucket: "apna-toon-stories-app.firebasestorage.app",
  messagingSenderId: "349839898094",
  appId: "1:349839898094:web:67ae84cad437f0c1964aff"
};

// --- INITIALIZE FIREBASE ---
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// --- HELPER: PCM to WAV Converter for Gemini TTS ---
const pcmToWav = (pcmData, sampleRate = 24000) => {
  const headerLength = 44;
  const wavData = new Uint8Array(headerLength + pcmData.byteLength);
  const view = new DataView(wavData.buffer);

  // RIFF identifier
  view.setUint32(0, 1179011410, false); // "RIFF"
  // file length
  view.setUint32(4, 36 + pcmData.byteLength, true);
  // RIFF type
  view.setUint32(8, 1163280727, false); // "WAVE"
  // format chunk identifier
  view.setUint32(12, 544501094, false); // "fmt "
  // format chunk length
  view.setUint32(16, 16, true);
  // sample format (raw)
  view.setUint16(20, 1, true);
  // channel count (1)
  view.setUint16(22, 1, true);
  // sample rate
  view.setUint32(24, sampleRate, true);
  // byte rate (sample rate * block align)
  view.setUint32(28, sampleRate * 2, true);
  // block align (channel count * bytes per sample)
  view.setUint16(32, 2, true);
  // bits per sample
  view.setUint16(34, 16, true);
  // data chunk identifier
  view.setUint32(36, 1635017060, false); // "data"
  // data chunk length
  view.setUint32(40, pcmData.byteLength, true);

  wavData.set(new Uint8Array(pcmData), headerLength);
  return wavData.buffer;
};

export default function ApnaToonApp() {
  // --- STATE MANAGEMENT ---
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true); 
  const [stories, setStories] = useState([]); 
  const [dataLoading, setDataLoading] = useState(true);
  
  const [activeTab, setActiveTab] = useState('All');
  const [activeNav, setActiveNav] = useState('Home');
  const [readingStory, setReadingStory] = useState(null);
  const [savedStoryIds, setSavedStoryIds] = useState([]);
  
  // --- GEMINI AI STATE ---
  const [isCreatorOpen, setCreatorOpen] = useState(false);
  const [prompt, setPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedStory, setGeneratedStory] = useState(null);

  // --- TTS, SEQUEL, QUIZ & TRANSLATE STATE ---
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [audioLoading, setAudioLoading] = useState(false);
  const audioRef = useRef(null);
  const [isSequelLoading, setIsSequelLoading] = useState(false);

  // Translate State
  const [isTranslating, setIsTranslating] = useState(false);
  const [originalContent, setOriginalContent] = useState(null); // To revert back to English

  // Quiz State
  const [isQuizOpen, setQuizOpen] = useState(false);
  const [quizLoading, setQuizLoading] = useState(false);
  const [quizQuestions, setQuizQuestions] = useState([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [quizScore, setQuizScore] = useState(0);
  const [showQuizResult, setShowQuizResult] = useState(false);
  const [selectedAnswer, setSelectedAnswer] = useState(null);

  // Categories
  const categories = [
    { name: 'All', color: 'bg-orange-400 text-white' },
    { name: 'Moral Stories', color: 'bg-red-300 text-red-900' },
    { name: 'Bedtime', color: 'bg-blue-300 text-blue-900' },
    { name: 'Fantasy', color: 'bg-purple-300 text-purple-900' },
    { name: 'Animal Tales', color: 'bg-green-300 text-green-900' },
  ];

  // --- AUTHENTICATION ---
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setAuthLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleGoogleLogin = async () => {
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
    } catch (error) {
      console.error("Google login error", error);
      alert("Oops! Login failed. Please try again.");
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      setActiveNav('Home'); 
    } catch (error) {
      console.error("Logout error", error);
    }
  };

  // --- FETCH DATA ---
  useEffect(() => {
    if (!user) return; 

    const q = query(collection(db, "stories"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedStories = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      fetchedStories.sort((a, b) => a.id.localeCompare(b.id));
      setStories(fetchedStories);
      setDataLoading(false);
    }, (error) => {
      console.error("Error reading backpack:", error);
      setDataLoading(false);
    });
    return () => unsubscribe();
  }, [user]);

  // --- HELPER: CONVERT STRING TO ICON ---
  const getIcon = (type) => {
    switch (type) {
      case 'star': return <Star className="text-yellow-300 fill-yellow-300" size={48} />;
      case 'lion': return <span className="text-5xl">🦁</span>;
      case 'tree': return <span className="text-5xl">🌳</span>;
      case 'magic': return <Sparkles className="text-purple-300" size={48} />;
      default: return <BookOpen className="text-white" size={48} />;
    }
  };

  // --- ACTIONS ---
  const toggleSave = (e, id) => {
    e.stopPropagation();
    if (savedStoryIds.includes(id)) {
      setSavedStoryIds(savedStoryIds.filter(sid => sid !== id));
    } else {
      setSavedStoryIds([...savedStoryIds, id]);
    }
  };

  const handleReadStory = (story) => {
    stopAudio(); 
    setReadingStory(story);
    setCreatorOpen(false);
    setOriginalContent(null); // Reset translation state
    setIsTranslating(false);
  };

  const stopAudio = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    setIsPlayingAudio(false);
  };

  // --- FILTER LOGIC ---
  const getFilteredStories = () => {
    if (activeNav === 'Saved') {
      return stories.filter(story => savedStoryIds.includes(story.id));
    }
    if (activeNav === 'Search') return stories;
    if (activeTab === 'All') return stories;
    return stories.filter(story => story.category === activeTab);
  };

  const filteredStories = getFilteredStories();

  // --- GEMINI API: GENERATE STORY ---
  const generateStory = async () => {
    if (!prompt) return;
    setIsGenerating(true);
    setGeneratedStory(null);
    const apiKey = ""; 
    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [{ text: `Write a short, fun children's story (150 words) about: "${prompt}". Catchy title in bold.` }] }]
          }),
        }
      );
      const data = await response.json();
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (text) setGeneratedStory(text);
      else setGeneratedStory("Magic failed! Try again.");
    } catch (error) {
      setGeneratedStory("Oops! Internet error.");
    } finally {
      setIsGenerating(false);
    }
  };

  // --- GEMINI API: GENERATE SEQUEL ---
  const generateSequel = async () => {
    if (!readingStory) return;
    setIsSequelLoading(true);
    const apiKey = "";
    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [{ text: `Continue this children's story: "${readingStory.title}". The previous part ended with: "${readingStory.content.slice(-100)}". Write a short, fun sequel (100-150 words). Start with a bold title like "**${readingStory.title}: Part 2**".` }] }]
          }),
        }
      );
      const data = await response.json();
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (text) {
        let title = `${readingStory.title} Part 2`;
        let content = text;
        const titleMatch = text.match(/\*\*(.*?)\*\*/);
        if (titleMatch) {
          title = titleMatch[1];
          content = text.replace(titleMatch[0], '').trim();
        }
        
        const newStory = {
          id: `sequel-${Date.now()}`,
          title: title,
          author: "Gemini ✨",
          category: readingStory.category,
          content: content,
          gradient: "from-pink-400 to-purple-500",
          accent: "bg-purple-100 text-purple-700",
          readTime: "2 min",
          iconType: 'magic'
        };
        handleReadStory(newStory);
      }
    } catch (error) {
      console.error("Sequel error:", error);
    } finally {
      setIsSequelLoading(false);
    }
  };

  // --- GEMINI API: TRANSLATE TO HINDI ---
  const translateStory = async () => {
    if (!readingStory) return;

    // Toggle back to English if already translated
    if (originalContent) {
      setReadingStory(prev => ({ ...prev, content: originalContent }));
      setOriginalContent(null);
      return;
    }

    setIsTranslating(true);
    const apiKey = "";
    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [{ text: `Translate the following children's story to Hindi. Keep it simple, fun, and suitable for kids. Return ONLY the translated text. Story: "${readingStory.content}"` }] }]
          }),
        }
      );
      const data = await response.json();
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
      
      if (text) {
        setOriginalContent(readingStory.content); // Save English
        setReadingStory(prev => ({ ...prev, content: text })); // Show Hindi
      }
    } catch (error) {
      console.error("Translation error:", error);
      alert("Translation failed. The internet pixies are busy!");
    } finally {
      setIsTranslating(false);
    }
  };

  // --- GEMINI API: GENERATE QUIZ ---
  const generateQuiz = async () => {
    if (!readingStory) return;
    setQuizOpen(true);
    setQuizLoading(true);
    setQuizQuestions([]);
    setShowQuizResult(false);
    setQuizScore(0);
    setCurrentQuestionIndex(0);

    const apiKey = "";
    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [{ text: `Generate 3 multiple-choice questions for children based on this story. Return the output as a RAW JSON Array (no markdown code blocks). Format: [{"question": "...", "options": ["A", "B", "C", "D"], "correctAnswer": "The exact string of the correct option"}]. Story: "${readingStory.content}"` }] }]
          }),
        }
      );
      const data = await response.json();
      let text = data.candidates?.[0]?.content?.parts?.[0]?.text;
      
      // Clean up markdown if Gemini adds it
      text = text.replace(/```json|```/g, '').trim();
      
      const questions = JSON.parse(text);
      if (Array.isArray(questions)) {
        setQuizQuestions(questions);
      } else {
        throw new Error("Invalid format");
      }
    } catch (error) {
      console.error("Quiz error:", error);
      setQuizQuestions([]); // Should handle error UI
    } finally {
      setQuizLoading(false);
    }
  };

  const handleQuizAnswer = (option) => {
    setSelectedAnswer(option);
    
    // Check answer
    const currentQ = quizQuestions[currentQuestionIndex];
    if (option === currentQ.correctAnswer) {
      setQuizScore(prev => prev + 1);
    }

    // Delay before next question
    setTimeout(() => {
      if (currentQuestionIndex < quizQuestions.length - 1) {
        setCurrentQuestionIndex(prev => prev + 1);
        setSelectedAnswer(null);
      } else {
        setShowQuizResult(true);
      }
    }, 1000);
  };

  // --- GEMINI API: TEXT TO SPEECH ---
  const playStoryAudio = async () => {
    if (!readingStory?.content) return;
    if (isPlayingAudio) {
      stopAudio();
      return;
    }
    
    setAudioLoading(true);
    const apiKey = "";
    
    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-tts:generateContent?key=${apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [{ text: readingStory.content }] }],
            generationConfig: {
              responseModalities: ["AUDIO"],
              speechConfig: {
                voiceConfig: { prebuiltVoiceConfig: { voiceName: "Kore" } }
              }
            }
          }),
        }
      );
      
      const data = await response.json();
      const base64Audio = data.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      
      if (base64Audio) {
        const binaryString = window.atob(base64Audio);
        const len = binaryString.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        
        const wavBuffer = pcmToWav(bytes.buffer);
        const blob = new Blob([wavBuffer], { type: 'audio/wav' });
        const url = URL.createObjectURL(blob);
        
        const audio = new Audio(url);
        audioRef.current = audio;
        audio.play();
        setIsPlayingAudio(true);
        audio.onended = () => setIsPlayingAudio(false);
      }
    } catch (error) {
      console.error("TTS Error", error);
    } finally {
      setAudioLoading(false);
    }
  };

  const openAIStory = () => {
    if (!generatedStory) return;
    let title = "My Magic Story";
    let content = generatedStory;
    const titleMatch = generatedStory.match(/\*\*(.*?)\*\*/);
    if (titleMatch) {
      title = titleMatch[1];
      content = generatedStory.replace(titleMatch[0], '').trim();
    }
    const newStory = {
      id: 999,
      title: title,
      author: "Magic AI",
      category: "Custom",
      content: content,
      gradient: "from-pink-400 to-purple-500",
      accent: "bg-purple-100 text-purple-700",
      readTime: "2 min",
      iconType: 'magic'
    };
    handleReadStory(newStory);
  };

  // --- LOADING SCREEN ---
  if (authLoading) {
    return (
      <div className="min-h-screen bg-[#FFF8F0] flex items-center justify-center">
         <div className="w-12 h-12 border-4 border-orange-200 border-t-orange-500 rounded-full animate-spin"></div>
      </div>
    );
  }

  // --- LOGIN SCREEN ---
  if (!user) {
    return (
      <div className="min-h-screen bg-[#5B9BD5] flex flex-col items-center justify-center p-6 text-center relative overflow-hidden">
        <style>{`@import url('https://fonts.googleapis.com/css2?family=Baloo+Bhai+2:wght@400;600;800&display=swap'); body { font-family: 'Baloo Bhai 2', cursive; }`}</style>
        
        <div className="absolute top-[-50px] left-[-50px] w-40 h-40 bg-white/10 rounded-full blur-2xl"></div>
        <div className="absolute bottom-[-50px] right-[-50px] w-60 h-60 bg-[#FFD700]/20 rounded-full blur-3xl"></div>

        <div className="bg-white p-4 rounded-full shadow-lg mb-6 animate-bounce">
          <BookOpen size={48} className="text-[#5B9BD5]" />
        </div>
        
        <h1 className="text-5xl font-extrabold text-[#FFD700] drop-shadow-md mb-2" style={{ textShadow: '2px 2px 0px #3b6b96' }}>Apna TOON</h1>
        <p className="text-white text-xl font-bold tracking-wider uppercase opacity-90 mb-12">Katha World</p>

        <div className="bg-white/10 backdrop-blur-md p-8 rounded-3xl border border-white/20 shadow-xl max-w-sm w-full">
           <p className="text-white mb-6 text-lg font-medium">Ready for a magical story adventure?</p>
           <button 
             onClick={handleGoogleLogin}
             className="w-full bg-white hover:bg-gray-50 text-gray-800 font-bold py-4 px-6 rounded-xl shadow-md transition-transform active:scale-95 flex items-center justify-center gap-3"
           >
             <div className="w-6 h-6 rounded-full bg-white border border-gray-200 flex items-center justify-center overflow-hidden shrink-0">
                <svg viewBox="0 0 24 24" className="w-full h-full"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
             </div>
             Start Your Adventure
           </button>
           <p className="text-blue-100 text-xs mt-4">Sign in securely with Google</p>
        </div>
      </div>
    );
  }

  // --- READER VIEW ---
  if (readingStory) {
    return (
      <div className="min-h-screen bg-[#FDF6E3] font-serif animate-in slide-in-from-right duration-300 relative">
         <style>{`@import url('https://fonts.googleapis.com/css2?family=Baloo+Bhai+2:wght@400;600;800&display=swap'); body { font-family: 'Baloo Bhai 2', cursive; }`}</style>
        
        {/* Header */}
        <div className="sticky top-0 bg-[#FDF6E3]/95 backdrop-blur-sm border-b border-orange-100 p-4 flex justify-between items-center z-20">
          <button onClick={() => handleReadStory(null)} className="p-2 rounded-full hover:bg-orange-100 text-gray-700 transition-colors"><ArrowLeft size={24} /></button>
          
          <div className="flex gap-2 items-center">
            {/* Translate Button */}
             <button 
              onClick={translateStory}
              disabled={isTranslating}
              className={`p-2 rounded-full transition-colors ${originalContent ? 'bg-indigo-100 text-indigo-600' : 'hover:bg-orange-100 text-gray-700'}`}
              title="Translate to Hindi"
            >
              {isTranslating ? <div className="w-5 h-5 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" /> : <Globe size={20} />}
            </button>

            {/* Listen Button */}
            <button 
              onClick={playStoryAudio}
              disabled={audioLoading}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-full font-sans text-xs font-bold transition-all
                ${isPlayingAudio ? 'bg-red-100 text-red-600 animate-pulse' : 'bg-orange-100 text-orange-700 hover:bg-orange-200'}`}
            >
              {audioLoading ? <div className="w-4 h-4 border-2 border-orange-400 border-t-transparent rounded-full animate-spin" /> : isPlayingAudio ? <><StopCircle size={16} /> Stop</> : <><Volume2 size={16} /> Listen</>}
            </button>
            
            <button className="p-2 rounded-full hover:bg-orange-100 text-gray-700"><Heart size={20} className={savedStoryIds.includes(readingStory.id) ? "fill-red-500 text-red-500" : ""} /></button>
          </div>
        </div>
        
        <div className="max-w-2xl mx-auto p-6 pb-24">
          <div className={`w-full h-48 rounded-2xl bg-gradient-to-br ${readingStory.gradient || 'from-blue-400 to-blue-600'} flex items-center justify-center mb-8 shadow-lg`}>
             {getIcon(readingStory.iconType)}
          </div>
          <h1 className="text-3xl font-extrabold text-gray-900 mb-2 leading-tight">{readingStory.title}</h1>
          <div className="flex items-center gap-3 text-sm text-gray-500 mb-8 font-bold">
             <span className="flex items-center gap-1"><User size={14}/> {readingStory.author}</span>
             <span className="flex items-center gap-1"><Clock size={14}/> {readingStory.readTime}</span>
             <span className={`px-2 py-0.5 rounded-md ${readingStory.accent} text-xs font-bold uppercase`}>{readingStory.category}</span>
          </div>
          <div className="prose prose-lg prose-orange text-gray-800 leading-loose font-medium">
            {readingStory.content ? readingStory.content.split('\n').map((paragraph, idx) => (
              <p key={idx} className="mb-4">{paragraph}</p>
            )) : <p>Loading story content...</p>}
          </div>
          
          <div className="mt-12 pt-8 border-t border-orange-200 text-center space-y-4">
            <p className="text-orange-800 text-sm font-bold">The End</p>
            
            <div className="flex gap-2">
              {/* QUIZ BUTTON */}
              <button 
                onClick={generateQuiz}
                className="flex-1 py-4 bg-white border-2 border-orange-200 text-orange-600 rounded-2xl font-sans font-bold shadow-sm hover:bg-orange-50 active:scale-95 transition-all flex items-center justify-center gap-2"
              >
                <Brain size={20} /> Play Quiz
              </button>

              {/* SEQUEL BUTTON */}
              <button 
                onClick={generateSequel}
                disabled={isSequelLoading}
                className="flex-1 py-4 bg-gradient-to-r from-purple-500 to-indigo-600 text-white rounded-2xl font-sans font-bold shadow-lg hover:shadow-xl active:scale-95 transition-all flex items-center justify-center gap-2"
              >
                {isSequelLoading ? <Sparkles className="animate-spin" /> : <Sparkles />} 
                {isSequelLoading ? "Writing..." : "Next Part?"}
              </button>
            </div>
          </div>
        </div>

        {/* --- QUIZ MODAL --- */}
        {isQuizOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
            <div className="bg-white w-full max-w-md rounded-3xl p-6 shadow-2xl relative animate-in zoom-in-95">
              <button onClick={() => setQuizOpen(false)} className="absolute top-4 right-4 bg-gray-100 p-2 rounded-full text-gray-500 hover:bg-gray-200"><X size={20} /></button>
              
              <div className="flex flex-col items-center mb-6">
                <div className="bg-orange-100 p-3 rounded-full mb-3"><Brain className="text-orange-600" size={32} /></div>
                <h2 className="text-2xl font-extrabold text-gray-800 text-center">Story Quiz!</h2>
              </div>

              {quizLoading ? (
                 <div className="flex flex-col items-center py-10 space-y-4">
                  <div className="w-12 h-12 border-4 border-orange-200 border-t-orange-600 rounded-full animate-spin"></div>
                  <p className="text-orange-600 font-bold animate-pulse">Thinking of questions...</p>
                </div>
              ) : showQuizResult ? (
                 <div className="text-center py-6">
                   <div className="text-6xl mb-4">{quizScore === 3 ? '🏆' : quizScore > 0 ? '🌟' : '💪'}</div>
                   <h3 className="text-2xl font-bold text-gray-800 mb-2">You scored {quizScore} out of {quizQuestions.length}!</h3>
                   <p className="text-gray-500 mb-6">{quizScore === 3 ? 'Perfect! You are a reading genius!' : 'Great job! Keep reading!'}</p>
                   <button onClick={() => setQuizOpen(false)} className="w-full py-3 bg-orange-500 text-white rounded-xl font-bold">Close Quiz</button>
                 </div>
              ) : quizQuestions.length > 0 ? (
                 <div>
                   <div className="mb-4 flex justify-between text-xs font-bold text-gray-400 uppercase tracking-widest">
                     <span>Question {currentQuestionIndex + 1} of {quizQuestions.length}</span>
                     <span>Score: {quizScore}</span>
                   </div>
                   <h3 className="text-lg font-bold text-gray-800 mb-6 leading-relaxed">{quizQuestions[currentQuestionIndex].question}</h3>
                   <div className="space-y-3">
                     {quizQuestions[currentQuestionIndex].options.map((option, idx) => (
                       <button 
                         key={idx}
                         onClick={() => handleQuizAnswer(option)}
                         disabled={selectedAnswer !== null}
                         className={`w-full p-4 rounded-xl font-medium text-left transition-all border-2
                           ${selectedAnswer === option 
                             ? (option === quizQuestions[currentQuestionIndex].correctAnswer 
                                ? 'bg-green-100 border-green-400 text-green-800' 
                                : 'bg-red-100 border-red-400 text-red-800')
                             : 'bg-gray-50 border-gray-100 hover:bg-orange-50 hover:border-orange-200 text-gray-700'}
                         `}
                       >
                         <div className="flex items-center justify-between">
                           <span>{option}</span>
                           {selectedAnswer === option && (
                             option === quizQuestions[currentQuestionIndex].correctAnswer 
                             ? <CheckCircle2 className="text-green-600" size={20}/>
                             : <XCircle className="text-red-600" size={20}/>
                           )}
                         </div>
                       </button>
                     ))}
                   </div>
                 </div>
              ) : (
                <div className="text-center text-red-400">Oops! Couldn't make a quiz for this story.</div>
              )}
            </div>
          </div>
        )}

      </div>
    );
  }

  // --- MAIN APP (Rest remains same) ---
  return (
    <div className="min-h-screen bg-[#FFF8F0] font-sans pb-24 relative overflow-hidden">
       <style>{`@import url('https://fonts.googleapis.com/css2?family=Baloo+Bhai+2:wght@400;600;800&display=swap'); body { font-family: 'Baloo Bhai 2', cursive; }`}</style>
      <div className="absolute top-20 left-4 text-orange-200 animate-pulse"><Star size={20} /></div>
      <div className="absolute top-40 right-10 text-blue-200"><Sparkles size={24} /></div>
      
      <header className="bg-[#5B9BD5] pt-8 pb-10 px-6 rounded-b-[40px] shadow-lg relative z-10 transition-all duration-300">
        <div className="flex flex-col items-center justify-center space-y-1">
          <div className="flex items-center gap-2 mb-1">
            <div className="bg-white p-2 rounded-full shadow-md"><BookOpen size={24} className="text-[#5B9BD5]" /></div>
          </div>
          <h1 className="text-4xl font-extrabold text-[#FFD700] drop-shadow-md tracking-wide" style={{ textShadow: '2px 2px 0px #3b6b96' }}>Apna TOON</h1>
          <p className="text-blue-50 text-base font-bold tracking-wider uppercase opacity-90">Katha World</p>
          <p className="text-white text-sm font-semibold bg-white/20 px-3 py-0.5 rounded-full mt-1">Apna TOON - ❣️ se Apna</p>
        </div>
      </header>

      {activeNav === 'Home' && (
        <div className="mt-6 pl-4 animate-in slide-in-from-bottom-2 duration-500">
          <div className="flex gap-3 overflow-x-auto pb-4 scrollbar-hide pr-4">
            {categories.map((cat) => (
              <button key={cat.name} onClick={() => setActiveTab(cat.name)} className={`px-5 py-2.5 rounded-full text-base font-bold whitespace-nowrap transition-all duration-200 shadow-sm border-2 border-transparent ${activeTab === cat.name ? 'bg-gray-800 text-white scale-105 shadow-md' : `${cat.color} hover:opacity-90 active:scale-95`}`}>{cat.name}</button>
            ))}
          </div>
        </div>
      )}

      <div className="px-5 mt-2 space-y-6 pb-20">
        <div className="flex justify-between items-end px-1 mt-4">
          <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
            {activeNav === 'Saved' ? <Heart className="text-red-500 fill-red-500" size={20} /> : <Sparkles size={20} className="text-orange-400" />}
            {activeNav === 'Saved' ? 'Your Collection' : (activeNav === 'Search' ? 'Search Results' : 'Top Stories')}
          </h2>
        </div>

        {dataLoading ? (
           <div className="flex justify-center py-20"><div className="w-10 h-10 border-4 border-orange-200 border-t-orange-500 rounded-full animate-spin"></div></div>
        ) : activeNav === 'Profile' ? (
          <div className="bg-white rounded-3xl p-8 text-center shadow-lg border border-orange-100 mt-8">
            <div className="w-24 h-24 rounded-full mx-auto mb-4 border-4 border-orange-200 overflow-hidden shadow-sm">
               {user.photoURL ? <img src={user.photoURL} alt="Profile" className="w-full h-full object-cover" /> : <div className="w-full h-full bg-orange-100 flex items-center justify-center text-4xl">👶</div>}
            </div>
            <h3 className="text-2xl font-bold text-gray-800">{user.displayName || "Junior Storyteller"}</h3>
            <p className="text-gray-500 text-base mt-2 font-semibold">{user.email}</p>
            <div className="mt-8 space-y-3">
              <button className="w-full py-3 bg-gray-100 hover:bg-gray-200 rounded-xl font-bold text-gray-600 transition-colors">Settings</button>
              <button onClick={handleLogout} className="w-full py-3 bg-red-50 text-red-500 hover:bg-red-100 rounded-xl font-bold flex items-center justify-center gap-2 transition-colors"><LogOut size={18} /> Log Out</button>
            </div>
          </div>
        ) : filteredStories.length > 0 ? (
          filteredStories.map((story) => (
            <div key={story.id} onClick={() => handleReadStory(story)} className="group relative bg-white rounded-3xl p-3 shadow-xl shadow-orange-100/50 border border-orange-50 transform transition-all duration-300 hover:scale-[1.02] hover:shadow-2xl cursor-pointer">
              <div className={`h-48 w-full rounded-2xl bg-gradient-to-br ${story.gradient || 'from-gray-300 to-gray-400'} relative flex items-center justify-center overflow-hidden`}>
                <div className="transform transition-transform duration-700 group-hover:scale-110 group-hover:-rotate-6">
                  {getIcon(story.iconType)}
                </div>
                <div className="absolute top-4 left-6 text-white/30"><Star size={12} /></div>
                <div className="absolute bottom-8 right-10 text-white/20"><Star size={16} /></div>
                <button onClick={(e) => toggleSave(e, story.id)} className="absolute top-3 left-3 bg-white/20 backdrop-blur-md border border-white/30 p-2 rounded-full shadow-sm hover:bg-white/40 transition-colors"><Heart size={16} className={savedStoryIds.includes(story.id) ? "fill-white text-white" : "text-white"} /></button>
                <div className="absolute top-3 right-3 bg-white/20 backdrop-blur-md border border-white/30 px-3 py-1 rounded-full flex items-center gap-1.5 shadow-sm"><Clock size={12} className="text-white" /><span className="text-xs font-bold text-white tracking-wide">{story.readTime}</span></div>
              </div>
              <div className="pt-4 px-2 pb-2">
                <div className="flex justify-between items-start mb-1">
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md uppercase tracking-wide ${story.accent || 'bg-gray-100 text-gray-600'}`}>{story.category}</span>
                  <div className="flex items-center gap-1 text-gray-400 text-xs font-semibold"><User size={12} /><span>{story.author}</span></div>
                </div>
                <h3 className="text-xl font-extrabold text-gray-800 leading-tight mt-2 mb-1 group-hover:text-[#5B9BD5] transition-colors">{story.title}</h3>
                <p className="text-gray-500 text-sm font-medium line-clamp-2 leading-relaxed mb-4">{story.desc}</p>
                <button className="w-full py-3 rounded-xl bg-gray-50 hover:bg-orange-50 text-gray-700 font-bold text-base flex items-center justify-center gap-2 group-hover:bg-orange-500 group-hover:text-white transition-all duration-300">Read Story <ChevronRight size={18} /></button>
              </div>
            </div>
          ))
        ) : (
          <div className="text-center py-20 opacity-50">
             <div className="text-6xl mb-4">📖</div>
             <p className="font-bold text-gray-400 text-lg">Backpack is empty!</p>
             <p className="text-sm text-gray-400 max-w-[200px] mx-auto mt-2">Check if your Firebase collection is named <b>"stories"</b> and permission rules are true.</p>
          </div>
        )}
      </div>

      {activeNav === 'Home' && (
        <button onClick={() => setCreatorOpen(true)} className="fixed bottom-24 right-5 bg-gradient-to-r from-purple-500 to-pink-500 text-white p-4 rounded-full shadow-lg hover:scale-110 active:scale-95 transition-all duration-300 z-40 border-4 border-white/20"><Wand2 size={28} className="animate-pulse" /></button>
      )}

      {isCreatorOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-md rounded-3xl p-6 shadow-2xl relative animate-in zoom-in-95 duration-200">
            <button onClick={() => setCreatorOpen(false)} className="absolute top-4 right-4 bg-gray-100 p-2 rounded-full text-gray-500 hover:bg-gray-200"><X size={20} /></button>
            <div className="flex flex-col items-center mb-6">
              <div className="bg-purple-100 p-3 rounded-full mb-3"><Sparkles className="text-purple-600" size={32} /></div>
              <h2 className="text-2xl font-extrabold text-gray-800 text-center">Magic Story Studio</h2>
              <p className="text-gray-500 text-center text-sm font-semibold">Tell me an idea, and I'll write a story!</p>
            </div>
            {!generatedStory && !isGenerating && (
              <div className="space-y-4">
                <textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder="e.g., A flying turtle who loves pizza..." className="w-full h-32 p-4 rounded-xl border-2 border-purple-100 bg-purple-50 focus:border-purple-400 focus:ring-0 resize-none text-gray-700 placeholder-gray-400 font-medium" />
                <button onClick={generateStory} disabled={!prompt} className={`w-full py-4 rounded-xl font-bold text-white shadow-lg transition-all ${prompt ? 'bg-gradient-to-r from-purple-500 to-pink-500 hover:shadow-purple-500/25 active:scale-95' : 'bg-gray-300 cursor-not-allowed'}`}>Create Magic Story ✨</button>
              </div>
            )}
            {isGenerating && (
              <div className="flex flex-col items-center py-10 space-y-4">
                <div className="w-12 h-12 border-4 border-purple-200 border-t-purple-600 rounded-full animate-spin"></div>
                <p className="text-purple-600 font-bold animate-pulse">Weaving magic words...</p>
              </div>
            )}
            {generatedStory && !isGenerating && (
              <div className="space-y-4">
                <div className="bg-orange-50 p-4 rounded-xl border border-orange-100 max-h-60 overflow-y-auto"><p className="text-gray-800 whitespace-pre-line leading-relaxed font-medium">{generatedStory.replace(/\*\*(.*?)\*\*/g, '$1')}</p></div>
                <div className="flex gap-2">
                  <button onClick={() => { setGeneratedStory(null); setPrompt(''); }} className="flex-1 py-3 rounded-xl border-2 border-gray-200 text-gray-600 font-bold hover:bg-gray-50">Create Another</button>
                  <button onClick={openAIStory} className="flex-1 py-3 rounded-xl bg-purple-600 text-white font-bold hover:bg-purple-700 shadow-lg shadow-purple-200">Read This!</button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="fixed bottom-0 w-full bg-white border-t border-gray-100 px-6 py-4 rounded-t-[30px] shadow-[0_-5px_20px_rgba(0,0,0,0.05)] z-30">
        <div className="flex justify-between items-center max-w-sm mx-auto">
          {['Home', 'Search', 'Saved', 'Profile'].map((item) => {
            const Icon = item === 'Home' ? Home : item === 'Search' ? Search : item === 'Saved' ? Heart : User;
            const isActive = activeNav === item;
            return (
              <button key={item} onClick={() => setActiveNav(item)} className={`flex flex-col items-center gap-1 transition-all duration-300 ${isActive ? 'text-orange-500 -translate-y-1' : 'text-gray-400'}`}>
                <Icon size={isActive ? 26 : 24} strokeWidth={isActive ? 2.5 : 2} fill={isActive && item === 'Saved' ? 'currentColor' : 'none'} />
                <span className={`text-[12px] font-bold ${isActive ? 'opacity-100' : 'opacity-0 h-0 overflow-hidden'}`}>{item}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
