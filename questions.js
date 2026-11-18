/*
 * ================== BỘ CÂU HỎI ==================
 * Sửa file này để thay câu hỏi của bạn (mở bằng Notepad / VS Code).
 *
 * Mỗi câu hỏi là một khối { ... } gồm:
 *   question : nội dung câu hỏi                        (bắt buộc)
 *   time     : thời gian suy nghĩ, tính bằng GIÂY      (không ghi thì dùng defaultTime bên dưới)
 *   options  : các lựa chọn A, B, C, D                  (không bắt buộc – bỏ đi nếu là câu tự luận)
 *   answer   : đáp án, hiện ra khi bấm "Hiện đáp án"    (không bắt buộc)
 *              Câu TRẮC NGHIỆM (có options): ghi answer là chữ cái "A"/"B"/"C"/"D"
 *                → học sinh bấm thẳng vào đáp án, máy TỰ CHẤM đúng/sai (hết giờ chưa chọn = sai).
 *              Câu TỰ LUẬN (không có options): người dẫn bấm nút ✓ Đúng / ✗ Sai.
 *   image    : đường dẫn ảnh minh họa, vd "images/cau1.png" (không bắt buộc)
 *
 * Lưu ý: các khối cách nhau bằng dấu phẩy, chữ đặt trong dấu ngoặc kép "...".
 */

window.GAME_CONFIG = {
  defaultTime: 30,   // thời gian mặc định (giây) cho câu không ghi "time"
  shuffle: false     // true = trộn ngẫu nhiên thứ tự câu hỏi, false = hỏi theo thứ tự trong file
};

window.QUESTIONS = [
  {
    question: "Thủ đô của Việt Nam là thành phố nào?",
    options: ["Hồ Chí Minh", "Hà Nội", "Đà Nẵng", "Huế"],
    answer: "B",
    time: 15
  },
  {
    question: "7 × 8 bằng bao nhiêu?",
    answer: "56",
    time: 10
  },
  {
    question: "Hành tinh nào lớn nhất trong Hệ Mặt Trời?",
    options: ["Sao Hỏa", "Trái Đất", "Sao Mộc", "Sao Thổ"],
    answer: "C",
    time: 20
  },
  {
    question: "Kể tên 3 loài động vật sống dưới nước.",
    answer: "Ví dụ: cá, tôm, cua, mực, cá heo…",
    time: 30
  },
  {
    question: "Một năm có bao nhiêu tháng có 31 ngày?",
    options: ["5", "6", "7", "8"],
    answer: "C",
    time: 20
  },
  {
    question: "Nước sôi ở bao nhiêu độ C (ở điều kiện bình thường)?",
    answer: "100 °C",
    time: 15
  },
  {
    question: "Từ nào trái nghĩa với \"chăm chỉ\"?",
    options: ["Siêng năng", "Lười biếng", "Cần cù", "Chịu khó"],
    answer: "B",
    time: 15
  },
  {
    question: "Hình vuông có cạnh 5 cm thì chu vi bằng bao nhiêu?",
    answer: "20 cm",
    time: 25
  },
  {
    question: "Sông nào dài nhất thế giới?",
    options: ["Sông Nile", "Sông Amazon", "Sông Mê Kông", "Sông Dương Tử"],
    answer: "A",
    time: 20
  },
  {
    question: "Con vật nào được gọi là \"chúa sơn lâm\"?",
    answer: "Con hổ",
    time: 10
  }
];
