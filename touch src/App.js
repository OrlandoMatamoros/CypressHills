import React, { useState, useEffect, useMemo } from 'react';
import { initializeApp, getApps } from 'firebase/app';
import { getFirestore, collection, doc, onSnapshot, addDoc, setDoc, deleteDoc, query, orderBy, getDocs } from 'firebase/firestore';
import { getAuth, signInAnonymously, onAuthStateChanged, signInWithCustomToken } from 'firebase/auth';
import { Plus, Save, Trash2, Edit, X, Bot, FileText, ListChecks, CalendarPlus, Download, Send } from 'lucide-react';

// --- Helper Components & Functions ---
const formatDate = (date) => {
    if (!date) return 'Date not available';
    const dateObj = date instanceof Date ? date : date.toDate();
    return new Intl.DateTimeFormat('en-US', { year: 'numeric', month: 'long', day: 'numeric' }).format(dateObj);
};

const FormattedSectionContent = ({ text }) => {
    if (!text || typeof text !== 'string' || text.trim() === '') return <p className="text-gray-500 italic">No notes for this section.</p>;
    const formatLine = (line, index) => {
        const parts = line.split(/:(.*)/s);
        if (parts.length > 1) {
            const key = parts[0].trim();
            const value = parts[1].trim();
            return (
                <div key={index} className="mb-1">
                    <strong className="text-gray-800">{key}:</strong>
                    <span className="text-blue-600 font-semibold ml-1">{value}</span>
                </div>
            );
        }
        return <div key={index}>{line}</div>;
    };
    return <div>{text.split('\n').map(formatLine)}</div>;
};

// --- Data & Templates ---
const initialMeetingsData = [ { date: new Date('2025-06-03T12:00:00Z'), title: "Business Partners/Community Kitchen Huddle", sections: { lib: "Ends March 2026\nGoal 50 participants/ Current: 20\nGoal 40 complete the program / Current:20\nGoal 36 increase in knowledge and/or implement a digital solution / Current:\nUpcoming cohort: July 15th tues/thur", dycd: "business partner intake\nGoal of 93 enrolled / Current: 74\nAdditional notes", businessPlans: "Goal of 37 / Previous meeting: / Current: 25\nProjected DYCD - 6\nDYCD- success story", commercialLease: "Notes:", kitchenMembers: "Goal of 25 / Pipeline: 6\nInspections - Deferring to June\nPrevious Meeting: 25\nCurrent: 24\nGoal: 25\nProspects: 3 (Royal V Eats, Skrimps Seafood, A Few Good Men)\nMaybe: 3 (Everything but the Meat, Highrise Food Co., Undine/Juicing)\nH26 renewal\nNotes:", avenueNYC: "Notes:", merchantOrganizing: "Notes:", enyFarmersMarket: "ENY Farmers Market - June 28th\nNotes:", bidUpdates: "Board Retreat\nNotes:", otherUpdates: "Daisha’s First Day\nEmily Visiting at next meeting\nThursday, Small Business event\nBP Outing\nJune 6th - Dave and Busters\nNotes:" } }];
const sectionTitles = { lib: "LIB", dycd: "DYCD", businessPlans: "Business Plans", commercialLease: "Commercial Lease Assistance", kitchenMembers: "Kitchen Members", bidUpdates: "BID Updates", avenueNYC: "AvenueNYC", merchantOrganizing: "Merchant Organizing", enyFarmersMarket: "ENY Farmers Market", otherUpdates: "Other Updates" };
const emptyMeeting = { title: "Business Partners/Community Kitchen Huddle", date: new Date(), sections: { lib: "Ends March: 2026\nGoal 50 participants/ Current:\nGoal 40 complete the program / Current:\nGoal 36 increase in knowledge and/or implement a digital solution / Current:\nUpcoming cohort:\nNotes:", dycd: "Business partner intake:\nGoal of 93 enrolled / Current:\nProjected DYCD:\nDYCD- success story:\nAdditional notes:", businessPlans: "Goal of 37 / Previous meeting: / Current:\nNotes:", commercialLease: "Goal 200 / Current:\nNotes:", kitchenMembers: "Goal of 25 / Current:\nPipeline:\nPrevious Meeting:\nProspects:\nMaybe:\nNotes:", bidUpdates: "Notes:", avenueNYC: "Notes:", merchantOrganizing: "Notes:", enyFarmersMarket: "Notes:", otherUpdates: "Notes:" } };

// --- Main App Component ---
export default function App() {
    // --- State Management ---
    const [meetings, setMeetings] = useState([]);
    const [draftMeeting, setDraftMeeting] = useState(null);
    const [selectedItem, setSelectedItem] = useState(null);
    const [isEditing, setIsEditing] = useState(false);
    const [db, setDb] = useState(null);
    const [userId, setUserId] = useState(null);
    const [loadingMessage, setLoadingMessage] = useState("Connecting to workspace...");
    const [isLoadingAI, setIsLoadingAI] = useState(false);
    const [modalContent, setModalContent] = useState(null);
    const [modalTitle, setModalTitle] = useState("");
    const [showScheduleModal, setShowScheduleModal] = useState(false);

    // --- App ID and Firebase Config ---
    const appId = (typeof __app_id !== 'undefined' ? __app_id : 'default-app-id');
    const firebaseConfig = useMemo(() => {
        if (typeof __firebase_config !== 'undefined' && __firebase_config) {
            try { return JSON.parse(__firebase_config); } catch (e) { console.error("Error parsing __firebase_config:", e); }
        }
        // Fallback for external environments like CodeSandbox
        return {
          apiKey: "AIzaSyD5gcaVcuJkMYP495S66j0Hv2S96tIVuSg",
          authDomain: "bp-ck-huddle.firebaseapp.com",
          projectId: "bp-ck-huddle",
          storageBucket: "bp-ck-huddle.appspot.com",
          messagingSenderId: "549928088571",
          appId: "1:549928088571:web:176e3e9392bd325e7f115e"
        };
    }, []);

    // --- Firebase Initialization and Auth ---
    useEffect(() => {
        if (!firebaseConfig) { setLoadingMessage("Firebase configuration is missing."); return; }
        try {
            const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
            const firestore = getFirestore(app);
            const authInstance = getAuth(app);
            setDb(firestore);
            onAuthStateChanged(authInstance, async (user) => {
                if (user) { setUserId(user.uid); } 
                else {
                    try {
                         if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
                            await signInWithCustomToken(authInstance, __initial_auth_token);
                         } else {
                            await signInAnonymously(authInstance);
                         }
                    } catch (error) {
                        console.error("Error signing in:", error);
                        setLoadingMessage("Authentication failed. Check console for details.");
                    }
                }
            });
        } catch (e) {
            console.error("Error initializing Firebase:", e);
            setLoadingMessage("Failed to initialize Firebase.");
        }
    }, [firebaseConfig]);

    // --- Data Loading: Published Meetings ---
    useEffect(() => {
        if (!userId || !db) return;
        setLoadingMessage("Fetching meetings...");
        const collectionPath = `artifacts/${appId}/public/data/meetings`;
        const q = query(collection(db, collectionPath), orderBy('date', 'desc'));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const meetingsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data(), date: doc.data().date?.toDate() }));
            setMeetings(meetingsData);
            if (!selectedItem && meetingsData.length > 0) {
                setSelectedItem(meetingsData[0]);
            }
            setLoadingMessage("");
        }, (error) => {
            console.error("Error fetching meetings:", error);
            setLoadingMessage("Error fetching meetings.");
        });
        return () => unsubscribe();
    }, [userId, db, appId]);
    
    // --- Data Loading: Draft Meeting ---
    useEffect(() => {
        if (!userId || !db) return;
        const draftDocRef = doc(db, `artifacts/${appId}/public/data/drafts`, 'current-draft');
        const unsubscribe = onSnapshot(draftDocRef, (docSnap) => {
            if (docSnap.exists()) {
                setDraftMeeting({ id: docSnap.id, ...docSnap.data(), date: docSnap.data().date?.toDate(), isDraft: true });
            } else {
                setDraftMeeting(null);
            }
        }, (error) => {
            console.error("Error fetching draft:", error);
        });
        return () => unsubscribe();
    }, [userId, db, appId]);

    // --- Event Handlers ---
    const handleSelectItem = (item) => {
        setSelectedItem(item);
        setIsEditing(false);
    };

    const handleEdit = () => {
        if (!selectedItem?.isDraft) return;
        setIsEditing(true);
    };

    const handleCreateOrEditDraft = () => {
        if (draftMeeting) {
            setSelectedItem(draftMeeting);
        } else {
            const newDraft = { ...emptyMeeting, date: new Date(), isDraft: true };
            setSelectedItem(newDraft);
        }
        setIsEditing(true);
    };

    const handleCancel = () => {
        setIsEditing(false);
        if (meetings.length > 0) {
            setSelectedItem(meetings[0]);
        } else {
            setSelectedItem(null);
        }
    };

    const handleSave = async () => {
        if (!db || !selectedItem?.isDraft) return;
        const draftDocRef = doc(db, `artifacts/${appId}/public/data/drafts`, 'current-draft');
        const { id, isDraft, ...dataToSave } = selectedItem;
        dataToSave.date = new Date(dataToSave.date);
        await setDoc(draftDocRef, dataToSave);
        setIsEditing(false);
    };
    
    const handlePublish = async () => {
        if (!db || !draftMeeting) return;
        const { id, isDraft, ...dataToPublish } = draftMeeting;
        
        await addDoc(collection(db, `artifacts/${appId}/public/data/meetings`), dataToPublish);
        await deleteDoc(doc(db, `artifacts/${appId}/public/data/drafts`, 'current-draft'));
        
        setSelectedItem(meetings[0] || null);
    };

    const handleDelete = async () => {
       if (!db || !selectedItem || selectedItem.isDraft) return;
       if (window.confirm("Are you sure you want to delete this published meeting? This action cannot be undone.")) {
            await deleteDoc(doc(db, `artifacts/${appId}/public/data/meetings`, selectedItem.id));
            setSelectedItem(meetings.length > 1 ? meetings[1] : null);
       }
    };
    
    if (!userId) {
         return (
            <div className="flex items-center justify-center h-screen bg-gray-100">
                <div className="p-4 text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                    <p className="text-gray-700">{loadingMessage}</p>
                </div>
            </div>
        );
    }

    return (
        <div className="flex h-screen font-sans bg-gray-50 text-gray-800">
            {isLoadingAI && <div className="fixed inset-0 bg-white bg-opacity-75 z-40 flex items-center justify-center"><div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-purple-500"></div></div>}
            {modalContent && <AIModal title={modalTitle} content={modalContent} onClose={() => setModalContent(null)} />}
            {showScheduleModal && <ScheduleModal onClose={() => setShowScheduleModal(false)} />}

            <aside className="w-1/3 max-w-sm bg-white border-r border-gray-200 flex flex-col">
                 <div className="p-4 border-b-2 border-dashed border-gray-300">
                    <h2 className="text-lg font-bold text-gray-900 mb-2">Upcoming Meeting</h2>
                    <div onClick={() => draftMeeting && handleSelectItem(draftMeeting)} className={`p-4 rounded-lg cursor-pointer ${selectedItem?.isDraft ? 'bg-yellow-100 border-yellow-400' : 'bg-gray-100 hover:bg-yellow-50'} border`}>
                        {draftMeeting ? (
                            <>
                                <p className="font-semibold text-yellow-800">Draft in Progress</p>
                                <p className="text-sm text-gray-600">Last updated: {formatDate(draftMeeting.date)}</p>
                            </>
                        ) : (
                            <p className="text-gray-500">No draft started.</p>
                        )}
                    </div>
                     <button onClick={handleCreateOrEditDraft} className="w-full mt-2 flex items-center justify-center gap-2 px-4 py-2 font-semibold text-white bg-yellow-500 rounded-lg hover:bg-yellow-600 transition-colors duration-200 shadow">
                        <Edit size={18} /> {draftMeeting ? 'Edit Draft' : 'Start New Draft'}
                    </button>
                </div>
                <div className="p-4">
                    <h1 className="text-xl font-bold text-gray-900">Published History</h1>
                </div>
                <div className="flex-grow overflow-y-auto">
                    {meetings.map(meeting => (
                        <div key={meeting.id}
                             className={`p-4 cursor-pointer border-l-4 ${selectedItem?.id === meeting.id ? 'border-blue-500 bg-blue-50' : 'border-transparent hover:bg-gray-100'}`}
                             onClick={() => handleSelectItem(meeting)}>
                            <p className="font-semibold">{meeting.title}</p>
                            <p className="text-sm text-gray-600">{formatDate(meeting.date)}</p>
                        </div>
                    ))}
                </div>
            </aside>

            <main className="flex-1 flex flex-col">
                {isEditing ? (
                    <EditView meeting={selectedItem} setMeeting={setSelectedItem} onSave={handleSave} onCancel={handleCancel} />
                ) : selectedItem ? (
                    <DetailView meeting={selectedItem} onEdit={handleEdit} onDelete={handleDelete} onPublish={handlePublish} />
                ) : (
                     <div className="flex-1 flex items-center justify-center text-center text-gray-500 bg-gray-100 p-4">
                        <div>
                           <Bot size={48} className="mx-auto text-gray-400 mb-4"/>
                           <h2 className="text-2xl font-bold">Welcome to Your Meeting Space</h2>
                           <p className="mt-2 max-w-md mx-auto">Select a meeting from the history or start a new draft.</p>
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
}

// --- Detail View Component ---
const DetailView = ({ meeting, onEdit, onDelete, onPublish }) => (
    <div className="flex-1 flex flex-col">
        <header className="p-4 bg-white border-b border-gray-200">
            <div className="flex justify-between items-start">
                 <div>
                    <h2 className="text-2xl font-bold text-gray-900">{meeting.title} {meeting.isDraft && <span className="text-sm font-normal text-yellow-600 bg-yellow-100 px-2 py-1 rounded-full ml-2">DRAFT</span>}</h2>
                    <p className="text-gray-600">{formatDate(meeting.date)}</p>
                </div>
                <div className="flex flex-col sm:flex-row gap-2">
                    {meeting.isDraft && (
                        <>
                            <button onClick={onEdit} className="flex items-center justify-center gap-2 px-4 py-2 font-semibold text-white bg-green-600 rounded-lg hover:bg-green-700 shadow-sm">
                                <Edit size={16} /> <span className="hidden sm:inline">Edit</span>
                            </button>
                            <button onClick={onPublish} className="flex items-center justify-center gap-2 px-4 py-2 font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 shadow-sm">
                                <Send size={16} /> <span className="hidden sm:inline">Publish</span>
                            </button>
                        </>
                    )}
                    {!meeting.isDraft && (
                         <button onClick={onDelete} className="flex items-center justify-center gap-2 px-4 py-2 font-semibold text-white bg-red-600 rounded-lg hover:bg-red-700 shadow-sm">
                            <Trash2 size={16} /> <span className="hidden sm:inline">Delete</span>
                        </button>
                    )}
                </div>
            </div>
        </header>
        <div className="flex-1 p-6 overflow-y-auto bg-gray-50">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {Object.keys(sectionTitles).map((key) => (
                    <div key={key} className="bg-white p-5 rounded-lg shadow-sm border border-gray-200">
                        <h3 className="font-bold text-lg mb-2 text-gray-800">{sectionTitles[key]}</h3>
                        <FormattedSectionContent text={meeting.sections[key]} />
                    </div>
                ))}
            </div>
        </div>
    </div>
);

// --- Edit View Component ---
const EditView = ({ meeting, setMeeting, onSave, onCancel }) => {
    const handleInputChange = (e, section) => {
        const { value } = e.target;
        setMeeting(prev => ({ ...prev, sections: { ...prev.sections, [section]: value } }));
    };

    const handleDateChange = (e) => {
        setMeeting(prev => ({ ...prev, date: e.target.value }));
    };

    return (
     <div className="flex-1 flex flex-col bg-gray-100">
        <header className="p-4 bg-white border-b border-gray-200 flex justify-between items-center">
            <h2 className="text-2xl font-bold text-gray-900">Editing Draft</h2>
            <div className="flex gap-2">
                 <button onClick={onCancel} className="flex items-center gap-2 px-4 py-2 font-semibold text-gray-700 bg-gray-200 rounded-lg hover:bg-gray-300">
                    <X size={16}/> Cancel
                 </button>
                <button onClick={onSave} className="flex items-center gap-2 px-4 py-2 font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 shadow">
                    <Save size={16} /> Save Draft
                </button>
            </div>
        </header>
        <div className="flex-1 p-6 overflow-y-auto">
            <div className="mb-6 max-w-xs">
                 <label htmlFor="meetingDate" className="block text-sm font-medium text-gray-700 mb-1">Meeting Date</label>
                 <input type="date" id="meetingDate" 
                        value={meeting && meeting.date instanceof Date ? meeting.date.toISOString().split('T')[0] : (meeting ? meeting.date : '')}
                        onChange={handleDateChange}
                        className="w-full p-2 border border-gray-300 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500"/>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {meeting && Object.keys(sectionTitles).map((key) => (
                    <div key={key} className="bg-white p-5 rounded-lg shadow-sm border border-gray-200 flex flex-col">
                        <h3 className="font-bold text-lg text-gray-800 mb-2">{sectionTitles[key]}</h3>
                        <textarea
                            value={meeting.sections[key] || ''}
                            onChange={(e) => onInputChange(e, key)}
                            className="w-full flex-grow p-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 transition-shadow"
                            rows="5"
                            placeholder={`Add notes for ${sectionTitles[key]}...`}>
                        </textarea>
                    </div>
                ))}
            </div>
        </div>
    </div>
    )
};

// --- AI Modal Component ---
const AIModal = ({ title, content, onClose }) => {
    const downloadTxtFile = () => {
        const element = document.createElement("a");
        const file = new Blob([content.replace(/<br \/>/g, "\n")], {type: 'text/plain;charset=utf-8'});
        element.href = URL.createObjectURL(file);
        element.download = "ai_summary.txt";
        document.body.appendChild(element);
        element.click();
        document.body.removeChild(element);
    }

    const formatContent = (text) => {
        let html = text
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') 
            .replace(/\*(.*?)\*/g, '<em>$1</em>')       
            .replace(/(\n|^)### (.*)/g, '$1<h3 class="text-lg font-semibold mt-4 mb-2">$2</h3>')
            .replace(/(\n|^)## (.*)/g, '$1<h2 class="text-xl font-bold mt-5 mb-3">$2</h2>')
            .replace(/(\n|^)# (.*)/g, '$1<h1 class="text-2xl font-bold mt-6 mb-4">$2</h1>')
            .replace(/\n\s*-\s/g, '\n<li class="ml-5">') 
            .replace(/(\n<li>.*)+/g, (match) => `<ul class="list-disc pl-5 mb-4">${match}\n</ul>`); 
        return { __html: html.replace(/\n/g, '<br />') };
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-lg shadow-2xl max-w-2xl w-full flex flex-col max-h-[90vh]">
                <header className="p-4 border-b flex justify-between items-center">
                    <h2 className="text-xl font-bold text-gray-800">{title}</h2>
                    <button onClick={onClose} className="p-2 rounded-full hover:bg-gray-200"> <X size={20} /> </button>
                </header>
                <main className="p-6 overflow-y-auto">
                    <div className="prose max-w-none" dangerouslySetInnerHTML={formatContent(content)}></div>
                </main>
                <footer className="p-4 bg-gray-50 border-t flex justify-between items-center">
                    <p className="text-xs text-gray-500">Content generated by Gemini AI. Please review.</p>
                    <button onClick={downloadTxtFile} className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700">
                        <Download size={16} /> Download .txt
                    </button>
                </footer>
            </div>
        </div>
    );
};

// --- Schedule Modal Component ---
const ScheduleModal = ({ onClose }) => {
    const teamEmails = ["kattyg@cypresshills.org", "maribelm@cypresshills.org", "pt_orlandom@cypresshills.org", "alexc@cypresshills.org", "angusf@cypresshills.org", "pt_leos@cypresshills.org", "pt_dasiaf@cypresshills.org", "hectorm@cypresshills.org", "pt_sha-rond@cypresshills.org"];
    const [eventDetails, setEventDetails] = useState({ title: "Next BP/CK Huddle", date: '', startTime: '10:00', endTime: '11:00', attendees: teamEmails.join(', ') });

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setEventDetails(prev => ({ ...prev, [name]: value }));
    };
    
    const createCalendarLink = (service) => {
        if (!eventDetails.date || !eventDetails.startTime || !eventDetails.endTime) { alert("Please fill in all date and time fields."); return; }
        const toISOStringWithTime = (date, time) => new Date(`${date}T${time}`).toISOString();
        const startDate = toISOStringWithTime(eventDetails.date, eventDetails.startTime);
        const endDate = toISOStringWithTime(eventDetails.date, eventDetails.endTime);
        const title = encodeURIComponent(eventDetails.title);
        const description = encodeURIComponent("This is the next meeting for the Business Partners/Community Kitchen Huddle.");
        
        if(service === 'google') {
            const googleFormatStartDate = startDate.replace(/-|:|\.\d{3}/g, '');
            const googleFormatEndDate = endDate.replace(/-|:|\.\d{3}/g, '');
            const url = `https://www.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${googleFormatStartDate}/${googleFormatEndDate}&details=${description}`;
            window.open(url, '_blank');
        } else if (service === 'outlook') {
            const url = `https://outlook.live.com/calendar/0/deeplink/compose?path=/calendar/action/compose&rru=addevent&subject=${title}&startdt=${startDate}&enddt=${endDate}&body=${description}`;
            window.open(url, '_blank');
        }
    };
    
    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-lg shadow-2xl max-w-lg w-full flex flex-col">
                 <header className="p-4 border-b flex justify-between items-center">
                    <h2 className="text-xl font-bold text-gray-800">Schedule Next Meeting</h2>
                    <button onClick={onClose} className="p-2 rounded-full hover:bg-gray-200"> <X size={20} /> </button>
                </header>
                 <main className="p-6 space-y-4">
                     <div>
                        <label htmlFor="title" className="block text-sm font-medium text-gray-700">Title</label>
                        <input type="text" name="title" id="title" value={eventDetails.title} onChange={handleInputChange} className="mt-1 block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm"/>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                         <div>
                            <label htmlFor="date" className="block text-sm font-medium text-gray-700">Date</label>
                            <input type="date" name="date" id="date" value={eventDetails.date} onChange={handleInputChange} className="mt-1 block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm"/>
                        </div>
                        <div>
                            <label htmlFor="startTime" className="block text-sm font-medium text-gray-700">Start Time</label>
                            <input type="time" name="startTime" id="startTime" value={eventDetails.startTime} onChange={handleInputChange} className="mt-1 block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm"/>
                        </div>
                         <div>
                            <label htmlFor="endTime" className="block text-sm font-medium text-gray-700">End Time</label>
                            <input type="time" name="endTime" id="endTime" value={eventDetails.endTime} onChange={handleInputChange} className="mt-1 block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm"/>
                        </div>
                    </div>
                     <div>
                        <label htmlFor="attendees" className="block text-sm font-medium text-gray-700">Attendees (for your reference)</label>
                        <textarea name="attendees" id="attendees" rows="3" value={eventDetails.attendees} onChange={handleInputChange} className="mt-1 block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm"></textarea>
                    </div>
                 </main>
                 <footer className="p-4 bg-gray-50 border-t flex justify-end gap-3">
                    <button onClick={() => createCalendarLink('google')} className="px-4 py-2 text-sm font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700">Add to Google Calendar</button>
                    <button onClick={() => createCalendarLink('outlook')} className="px-4 py-2 text-sm font-semibold text-white bg-gray-700 rounded-lg hover:bg-gray-800">Add to Outlook Calendar</button>
                 </footer>
            </div>
        </div>
    );
};