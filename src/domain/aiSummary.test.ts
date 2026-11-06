import { describe, expect, it } from "vitest";
import { buildAiData, questionKeywords } from "./aiSummary";

describe("questionKeywords", () => {
  it("מסיר מילות שאלה כלליות ומוסיף צורה בלי אות שימוש", () => {
    const k = questionKeywords("כמה הוצאתי לכבוד שבת קודש החודש?");
    expect(k).toContain("שבת");
    expect(k).toContain("קודש");
    expect(k).not.toContain("כמה");
    expect(questionKeywords("כמה הלך לשבת")).toContain("שבת");
  });
});

describe("buildAiData", () => {
  const item = (date: string, note: string, amountAgorot = 1000) =>
    ({
      date,
      note,
      type: "expense",
      amountAgorot,
      categoryName: "אוכל",
      counterparty: "סופר",
      paymentMethod: "cash",
      yearMonth: date.slice(0, 7),
    }) as never;
  const base = {
    spaceName: "בית",
    scopeLabel: "משק בית",
    today: "2026-11-06",
    selected: "2026-11",
    months: [],
    budgets: [],
    savingsGoal: null,
    debts: [],
    standingOrders: [],
    categories: [],
  };

  it("שולח פעולות החודש הנבחר בנפרד וסיכום חודשי על כל ההיסטוריה", () => {
    const items = [item("2026-11-02", "לכבוד שבת"), item("2025-01-05", "ישן")];
    const out = buildAiData({ ...base, items });
    expect(String(out.selectedMonthTransactions)).toContain("לכבוד שבת");
    expect(String(out.selectedMonthTransactions)).not.toContain("ישן");
    expect(String(out.monthlyCategoryTotals)).toContain("2025-01|E|אוכל|10");
  });

  it("מוסיף פעולות ישנות רק כשהן קשורות לשאלה", () => {
    const old = Array.from({ length: 1600 }, (_, i) =>
      item(
        `2024-01-${String((i % 28) + 1).padStart(2, "0")}`,
        i === 0 ? "ארוחת שבת מיוחדת" : "רגיל",
        100 + i,
      ),
    );
    const withQuestion = buildAiData(
      { ...base, items: old },
      "כמה הוצאתי על שבת",
    );
    const without = buildAiData({ ...base, items: old }, "");
    expect(String(withQuestion.transactions)).toContain("ארוחת שבת מיוחדת");
    expect(String(without.transactions)).not.toContain("ארוחת שבת מיוחדת");
  });
});
