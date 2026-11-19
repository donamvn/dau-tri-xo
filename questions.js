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
 *
 * Cách dùng câu hỏi trong game:
 *   - Đội chọn 1 ô trên bàn cờ, rồi câu hỏi hiện ra THEO ĐÚNG THỨ TỰ trong danh sách này
 *     (ô nào cũng vậy – chọn ô chỉ để vui).
 *   - Trả lời đúng: được đánh X/O vào ô đó. Trả lời sai: ô vẫn trống, lượt sau chọn lại được.
 *   - Khi đã có đội thắng mà còn câu hỏi chưa dùng → bấm vào các ô trống để mở tiếp.
 *   - Mỗi ván mới lại bắt đầu từ câu 1.
 */

window.GAME_CONFIG = {
  defaultTime: 30,   // thời gian mặc định (giây) cho câu không ghi "time"
  shuffle: false     // true = trộn ngẫu nhiên thứ tự câu hỏi, false = hỏi theo thứ tự trong file
};

// Câu hỏi trò chơi X – O (lấy từ Phiếu học tập số 1 – Áp suất khí quyển)
// Thời gian: 30s = 30, 1m = 60, 1m30s = 90, 2m = 120
window.QUESTIONS = [
  {
    question: "Quan sát thí nghiệm GV biểu diễn và giải thích hiện tượng quan sát được.",
    time: 90
  },
  {
    question: "Khi máy bay hạ cánh, hành khách trên máy bay thường bị ù tai. Nguyên nhân của hiện tượng đó là gì? Cho biết phía trong hay phía ngoài màng nhĩ có áp suất lớn hơn trong quá trình máy bay hạ cánh?",
    image: "images/cau2-tai.png",
    time: 120
  },
  {
    question: "Hình vẽ sau mô tả cấu tạo tai của một hành khách khi đi máy bay, em hãy xác định trạng thái di chuyển của máy bay trong mỗi trường hợp a) và b).",
    image: "images/cau3-tai-may-bay.png",
    options: ["Máy bay đang cất cánh", "Máy bay đang hạ cánh", "Máy bay đang bay ở độ cao ổn định"],
    time: 120
  },
  {
    question: "Khi máy bay sắp hạ cánh, nhiều hãng hàng không phát kẹo cho hành khách, và các mẹ thường cho em bé bú bình hoặc ngậm ti giả. Vì sao lại làm như vậy?",
    time: 60
  },
  {
    question: "Vì sao khi ấn phễu của giác mút áp sát vào mặt kính hoặc tường gạch men, giác mút có thể dính chặt vào bề mặt đó? Vì sao không sử dụng được giác mút với tường nhám?",
    time: 90
  },
  {
    question: "Muốn gỡ giác mút ra khỏi tấm kính, nếu nắm móc kéo thẳng ra thì rất khó, nhưng chỉ cần lấy móng tay nạy nhẹ một góc mép phễu là giác mút rơi ra ngay. Vì sao?",
    time: 60
  },
  {
    question:
      "Một giọt nước đang nằm dưới đáy bình xịt tưới cây và muốn bay ra ngoài để tưới cho chậu hoa. Hãy sắp xếp các bước sau theo đúng thứ tự để giúp giọt nước thoát ra khỏi bình:\n" +
      "a) Mở van, giọt nước bị đẩy lên theo ống nước và phun ra ở vòi phun.\n" +
      "b) Ấn tay bơm nhiều lần, pít-tông đưa không khí từ bên ngoài vào trong bình.\n" +
      "c) Khí nén ép mạnh lên mặt nước trong bình.\n" +
      "d) Không khí trong bình bị nén lại, áp suất khí trong bình tăng lên.",
    time: 30
  },
  {
    question: "Bạn An bơm bình xịt rồi tưới cây. Tưới được một lúc thì tia nước yếu dần, cuối cùng chỉ còn nhỏ giọt, dù trong bình vẫn còn nhiều nước. Vì sao? Bạn An phải làm gì để nước phun mạnh trở lại?",
    time: 120
  },
  {
    question: "Bịt kín đầu một xi lanh rồi kéo pít-tông ra để thể tích khí bên trong tăng lên. Quan sát và giải thích hiện tượng sau khi thả tay.",
    time: 120
  },
  {
    question: "Hút bớt không khí bên trong vỏ hộp đựng sữa bằng giấy, vì sao vỏ hộp bị bẹp theo nhiều phía?",
    time: 60
  },
  {
    question: "Khi em dùng ống hút để uống trà sữa, vì sao trà sữa lại đi lên được trong ống và chảy vào miệng?",
    time: 60
  },
  {
    question: "Vì sao muốn nước trong bình có thể chảy ra khi mở vòi thì trên nắp bình phải có một lỗ nhỏ?",
    image: "images/cau12-binh-nuoc.jpg",
    time: 90
  },
  {
    question: "Muốn rót sữa đặc ra khỏi lon, người ta thường đục 2 lỗ trên nắp thay vì chỉ 1 lỗ. Vì sao đục 2 lỗ thì sữa chảy ra dễ hơn?",
    time: 60
  }
];
