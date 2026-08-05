/**
 * Sample Seed Data Service
 * Provides rich, realistic Thai school data out-of-the-box.
 * Supports Username and Password fields (Default Student Username & Password = Student ID).
 */

export const INITIAL_USERS = [
  { id: 'usr_admin', username: 'admin', password: 'admin123', name: 'ผอ. สมศักดิ์ ใจดี (Admin)', email: 'admin@school.ac.th', role: 'Admin', studentId: '-', no: '-', grade: '-', room: '-' },
  { id: 'usr_t1', username: 'prasert', password: 'teacher123', name: 'ครูประเสริฐ วิทยา (ครูคณิต)', email: 'prasert@school.ac.th', role: 'Teacher', studentId: '-', no: '-', grade: '-', room: '-' },
  { id: 'usr_t2', username: 'wanna', password: 'teacher123', name: 'ครูวรรณา รักการอ่าน (ครูภาษาไทย)', email: 'wanna@school.ac.th', role: 'Teacher', studentId: '-', no: '-', grade: '-', room: '-' },
  { id: 'usr_s1', username: 'STD6701', password: 'STD6701', name: 'ด.ช. กิตติพงษ์ สุขสันต์', email: 'kittipong@student.ac.th', role: 'Student', studentId: 'STD6701', no: '1', grade: 'ม.1', room: '1' },
  { id: 'usr_s2', username: 'STD6702', password: 'STD6702', name: 'ด.ญ. ชลธิชา เพชรดี', email: 'chonthicha@student.ac.th', role: 'Student', studentId: 'STD6702', no: '2', grade: 'ม.1', room: '1' },
  { id: 'usr_s3', username: 'STD6703', password: 'STD6703', name: 'ด.ช. ธนพล มั่นคง', email: 'thanapol@student.ac.th', role: 'Student', studentId: 'STD6703', no: '1', grade: 'ม.1', room: '2' },
  { id: 'usr_s4', username: 'STD6704', password: 'STD6704', name: 'ด.ญ. ปรียาภรณ์ แสงทอง', email: 'preeyaporn@student.ac.th', role: 'Student', studentId: 'STD6704', no: '1', grade: 'ม.2', room: '1' },
  { id: 'usr_s5', username: 'STD6705', password: 'STD6705', name: 'ด.ช. ณัฐวุฒิ ยอดเยี่ยม', email: 'nattawut@student.ac.th', role: 'Student', studentId: 'STD6705', no: '1', grade: 'ม.3', room: '1' },
];

export const INITIAL_COURSES = [
  { id: 'crs_math', code: 'ค21101', name: 'คณิตศาสตร์พื้นฐาน ม.1', teacher: 'ครูประเสริฐ วิทยา', credits: 1.5, color: 'from-blue-600 to-indigo-600' },
  { id: 'crs_sci', code: 'ว21101', name: 'วิทยาศาสตร์และเทคโนโลยี ม.1', teacher: 'ครูประเสริฐ วิทยา', credits: 1.5, color: 'from-emerald-600 to-teal-600' },
  { id: 'crs_thai', code: 'ท21101', name: 'ภาษาไทย ม.1', teacher: 'ครูวรรณา รักการอ่าน', credits: 1.0, color: 'from-amber-600 to-orange-600' },
  { id: 'crs_eng', code: 'อ21101', name: 'ภาษาอังกฤษฟัง-พูด ม.1', teacher: 'ครูวรรณา รักการอ่าน', credits: 1.0, color: 'from-purple-600 to-pink-600' },
];

export const INITIAL_ANNOUNCEMENTS = [
  {
    id: 'anc_1',
    title: '📢 ตารางสอบกลางภาคเรียนที่ 1/2026',
    content: 'ขอให้นักเรียนทุกคนเตรียมตัวสอบกลางภาคระหว่างวันที่ 15-18 สิงหาคมนี้ โดยตรวจสอบตารางสอบได้ทางบอร์ดประกาศหลักของโรงเรียน',
    priority: 'Urgent',
    author: 'ผอ. สมศักดิ์ ใจดี',
    date: '2026-08-01 09:00',
  },
  {
    id: 'anc_2',
    title: '✨ โครงการแข่งขันทักษะคอมพิวเตอร์และ AI',
    content: 'รับสมัครนักเรียนเข้าร่วมการแข่งขันทักษะการเขียนโปรแกรมและสร้าง AI สำหรับนักเรียนชั้น ม.1-ม.3 ชิงทุนการศึกษา',
    priority: 'General',
    author: 'ครูประเสริฐ วิทยา',
    date: '2026-08-02 13:30',
  },
];

export const INITIAL_HOMEWORK = [
  {
    id: 'hw_1',
    courseId: 'crs_math',
    courseName: 'คณิตศาสตร์พื้นฐาน ม.1',
    title: 'แบบฝึกหัดเรื่อง สมการเชิงเส้นตัวแปรเดียว',
    detail: 'ทำแบบฝึกหัดข้อ 1-10 ในหนังสือเรียนหน้า 45 แล้วถ่ายรูปหรือพิมพ์คำตอบแนบลิงก์ไฟล์มาส่ง',
    dueDate: '2026-08-10',
    maxPoints: 20,
    submissions: [
      {
        studentId: 'STD6701',
        studentName: 'ด.ช. กิตติพงษ์ สุขสันต์',
        submittedAt: '2026-08-03 10:15',
        textResponse: 'ส่งงานครับ คำตอบข้อ 1=X:5, ข้อ 2=Y:12, ข้อ 3=Z:8',
        fileUrl: 'https://drive.google.com/file/d/sample-math-homework-pdf',
        score: 18,
        feedback: 'เก่งมาก คำตอบถูกต้อง มีผิดพลาดเล็กน้อยในข้อ 7',
        status: 'Graded'
      },
      {
        studentId: 'STD6702',
        studentName: 'ด.ญ. ชลธิชา เพชรดี',
        submittedAt: '2026-08-03 11:30',
        textResponse: 'แนบไฟล์คำตอบเรียบร้อยค่ะ',
        fileUrl: 'https://drive.google.com/file/d/sample-chonthicha-homework',
        score: null,
        feedback: '',
        status: 'Pending'
      }
    ]
  },
  {
    id: 'hw_2',
    courseId: 'crs_sci',
    courseName: 'วิทยาศาสตร์และเทคโนโลยี ม.1',
    title: 'รายงานสรุปเรื่อง เซลล์พืชและเซลล์สัตว์',
    detail: 'เขียนเปรียบเทียบความแตกต่างระหว่างเซลล์พืชและเซลล์สัตว์อย่างน้อย 5 ข้อ พร้อมยกตัวอย่างประกอบ',
    dueDate: '2026-08-12',
    maxPoints: 15,
    submissions: []
  }
];

export const SAMPLE_QUIZ = {
  id: 'qz_sample_1',
  title: '✨ แบบทดสอบวัดความรู้วิทยาศาสตร์และเทคโนโลยี ม.1 (ตัวอย่าง)',
  description: 'แบบทดสอบทดสอบระบบอัตโนมัติ พร้อมระบบป้องกันข้อสอบสูญหาย (Append Fallback) และตรวจคะแนนทันที',
  courseId: 'crs_sci',
  timeLimitMinutes: 5,
  questions: [
    {
      id: 'q1',
      questionText: 'ส่วนประกอบใดของเซลล์พืชที่ทำหน้าที่สังเคราะห์ด้วยแสง และไม่มีในเซลล์สัตว์?',
      options: [
        'A. นิวเคลียส (Nucleus)',
        'B. คลอโรพลาสต์ (Chloroplast)',
        'C. ไมโทคอนเดรีย (Mitochondria)',
        'D. เยื่อหุ้มเซลล์ (Cell Membrane)',
        'E. แวคิวโออล (Vacuole)'
      ],
      correctAnswer: 1,
      explanation: 'คลอโรพลาสต์เป็นออร์แกเนลล์ที่มีสารคลอโรฟิลล์สำหรับสังเคราะห์ด้วยแสง พบได้เฉพาะในเซลล์พืช'
    },
    {
      id: 'q2',
      questionText: 'ดาวเคราะห์ดวงใดในระบบสุริยะได้ชื่อว่าเป็น "ดาวเคราะห์แดง"?',
      options: [
        'A. ดาวพุธ',
        'B. ดาวศุกร์',
        'C. ดาวอังคาร',
        'D. ดาวพฤหัสบดี'
      ],
      correctAnswer: 2,
      explanation: 'ดาวอังคารมีพื้นผิวเต็มไปด้วยไอรอนออกไซด์ (สนิมเหล็ก) จึงมองเห็นเป็นสีแดง'
    },
    {
      id: 'q3',
      questionText: 'หน่วยประมวลผลกลางของคอมพิวเตอร์ทำหน้าที่เปรียบเสมือนสมองของเครื่องคืออะไร?',
      options: [
        'A. RAM',
        'B. Harddisk',
        'C. GPU',
        'D. CPU',
        'E. Power Supply'
      ],
      correctAnswer: 3,
      explanation: 'CPU (Central Processing Unit) ทำหน้าที่ประมวลผลและคำนวณคำสั่งทั้งหมดในคอมพิวเตอร์'
    }
  ]
};

export const INITIAL_ATTENDANCE = [
  {
    date: '2026-08-03',
    courseId: 'crs_math',
    grade: 'ม.1',
    room: '1',
    period: 'คาบที่ 1 (08:30 - 09:30)',
    records: {
      'STD6701': 'Present',
      'STD6702': 'Late',
      'STD6703': 'Present'
    }
  }
];
