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
    question: "Khi máy bay hạ cánh, hành khách trên máy bay thường bị ù tai. Nguyên nhân của hiện tượng đó là gì? Cho biết phía trong hay phía ngoài màng nhĩ có áp suất lớn hơn trong quá trình máy bay hạ cánh?",
    image: "images/cau2-tai.png",
    time: 90,
    answer:
      "Khi máy bay hạ cánh, độ cao giảm nhanh nên áp suất không khí bên ngoài tăng đột ngột. Vòi tai không phản ứng kịp, làm mất cân bằng áp suất hai bên màng nhĩ. Màng nhĩ bị đẩy về phía có áp suất nhỏ hơn, gây tiếng động trong tai hoặc ù tai. Cụ thể, phía ngoài màng nhĩ có áp suất lớn hơn."
  },
  {
    question: "Hình vẽ sau mô tả cấu tạo tai của một hành khách khi đi máy bay, em hãy xác định trạng thái di chuyển của máy bay trong mỗi trường hợp a) và b).",
    image: "images/cau3-tai-may-bay.png",
    options: ["Máy bay đang cất cánh", "Máy bay đang hạ cánh", "Máy bay đang bay ở độ cao ổn định"],
    time: 90,
    answer: "\na) – C. Máy bay đang bay ở độ cao ổn định\nb) – A. Máy bay đang cất cánh"
  },
  {
    question: "Khi máy bay sắp hạ cánh, nhiều hãng hàng không phát kẹo cho hành khách, và các mẹ thường cho em bé bú bình hoặc ngậm ti giả. Vì sao lại làm như vậy?",
    time: 60,
    answer:
      "Nhai kẹo, bú bình hoặc ngậm ti giả làm ta nuốt nhiều lần. Cử động nuốt khiến vòi tai mở rộng, không khí đi vào tai giữa, giúp cân bằng lại áp suất hai bên màng nhĩ, tránh ù tai hoặc đau tai."
  },
  {
    question: "Vì sao khi ấn phễu của giác mút áp sát vào mặt kính hoặc tường gạch men, giác mút có thể bám chặt vào bề mặt đó? Vì sao không sử dụng được giác mút với tường nhám?",
    image: "images/cau-giac-mut.png",
    time: 90,
    answer:
      "\n– Khi ấn phễu áp sát vào bề mặt nhẵn, không khí bên trong bị đẩy ra ngoài, áp suất không khí còn lại bên trong giác mút nhỏ hơn áp suất khí quyển bên ngoài. Áp suất khí quyển ép giác mút bám chặt vào bề mặt.\n" +
      "– Tường nhám có nhiều khe hở li ti, không khí bên ngoài dễ lọt vào bên trong phễu, áp suất bên trong bằng áp suất khí quyển nên giác mút không bám được và bị rơi."
  },
  {
    question: "Muốn gỡ giác mút ra khỏi tấm kính, nếu nắm móc kéo thẳng ra thì rất khó, nhưng chỉ cần lấy móng tay cậy nhẹ một góc mép phễu là giác mút rơi ra ngay. Vì sao?",
    time: 60,
    answer:
      "Khi kéo thẳng, ta phải thắng được lực do áp suất khí quyển ép giác mút vào kính nên rất khó. Khi cậy mép phễu, không khí bên ngoài lọt vào trong, áp suất bên trong tăng lên bằng áp suất khí quyển. Không còn chênh lệch áp suất nên giác mút rời ra dễ dàng."
  },
  {
    question:
      "Một giọt nước đang nằm dưới đáy bình xịt tưới cây và muốn bay ra ngoài để tưới cho chậu hoa. Hãy sắp xếp các bước sau theo đúng thứ tự để giúp giọt nước thoát ra khỏi bình:\n" +
      "a) Mở van, giọt nước bị đẩy lên theo ống nước và phun ra ở vòi phun.\n" +
      "b) Ấn tay bơm nhiều lần, pít-tông đưa không khí từ bên ngoài vào trong bình.\n" +
      "c) Khí nén ép mạnh lên mặt nước trong bình.\n" +
      "d) Không khí trong bình bị nén lại, áp suất khí trong bình tăng lên.",
    image: "images/cau-binh-xit.png",
    time: 30,
    answer: "b → d → c → a"
  },
  {
    question: "Bạn An bơm bình xịt rồi tưới cây. Tưới được một lúc thì tia nước yếu dần, cuối cùng chỉ còn nhỏ giọt, dù trong bình vẫn còn nhiều nước. Vì sao? Bạn An phải làm gì để nước phun mạnh trở lại?",
    time: 90,
    answer:
      "\n– Khi nước chảy ra, phần không gian chứa khí trong bình lớn dần (thể tích khí tăng) mà lượng khí không đổi, nên áp suất khí trong bình giảm dần. Khi áp suất trong bình gần bằng áp suất khí quyển thì không còn đủ sức đẩy nước ra mạnh.\n" +
      "– Bơm thêm để đưa thêm không khí vào bình, áp suất khí trong bình tăng lên, nước lại phun mạnh."
  },
  {
    question: "Bịt kín đầu một xi lanh rồi kéo pít-tông ra để thể tích khí bên trong tăng lên. Quan sát và giải thích hiện tượng sau khi thả tay.",
    time: 120,
    answer:
      "Khi kéo pít-tông, thể tích khí trong xi lanh tăng mà lượng khí không đổi nên áp suất khí bên trong giảm, nhỏ hơn áp suất khí quyển. Áp suất khí quyển bên ngoài đẩy pít-tông vào trong."
  },
  {
    question: "Hút bớt không khí bên trong vỏ hộp đựng sữa bằng giấy, vì sao vỏ hộp bị bẹp theo nhiều phía?",
    time: 60,
    answer:
      "Khi hút bớt không khí, áp suất khí bên trong hộp giảm, nhỏ hơn áp suất khí quyển bên ngoài. Áp suất khí quyển tác dụng lên vỏ hộp theo mọi phương nên vỏ hộp bị bẹp theo nhiều phía."
  },
  {
    question: "Khi em dùng ống hút để uống trà sữa, vì sao trà sữa lại đi lên được trong ống và chảy vào miệng?",
    time: 60,
    answer:
      "Khi hút, không khí trong ống bị hút ra nên áp suất trong ống giảm, nhỏ hơn áp suất khí quyển. Áp suất khí quyển tác dụng lên mặt trà sữa trong cốc đẩy trà sữa đi lên theo ống vào miệng."
  },
  {
    question: "Vì sao muốn nước trong bình có thể chảy ra khi mở vòi thì trên nắp bình phải có một lỗ nhỏ?",
    image: "images/cau12-binh-nuoc.jpg",
    time: 90,
    answer:
      "\n– Nếu nắp bình kín: khi nước chảy ra, không khí không vào được bình, áp suất khí phía trên mặt nước trong bình giảm, nhỏ hơn áp suất khí quyển ở miệng vòi, nên nước chảy yếu dần rồi ngừng chảy.\n" +
      "– Khi có lỗ nhỏ trên nắp: không khí đi vào bình, áp suất khí quyển tác dụng lên mặt nước trong bình, nên nước chảy ra khỏi vòi dễ dàng và đều."
  },
  {
    question: "Muốn rót sữa đặc ra khỏi lon, người ta thường đục 2 lỗ trên nắp thay vì chỉ 1 lỗ. Vì sao đục 2 lỗ thì sữa chảy ra dễ hơn?",
    time: 60,
    answer:
      "\n– Nếu chỉ có 1 lỗ: sữa chảy ra thì không khí khó vào lon, áp suất trong lon giảm, áp suất khí quyển bên ngoài cản sữa chảy ra nên sữa chảy rất chậm, ngắt quãng.\n" +
      "– Khi đục thêm lỗ thứ hai: không khí đi vào lon qua lỗ này, áp suất khí quyển tác dụng lên mặt sữa bên trong, nên sữa chảy ra lỗ kia đều và dễ dàng."
  }
];
