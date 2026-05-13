"""
Financial QA Question Bank
50 questions across 6 categories for evaluation benchmarking.
A random batch is sampled each run for variety.
Based on FinQA, ConvFinQA, and TATQA question patterns.
"""
import random
from typing import List, Dict

QUESTION_BANK: List[Dict] = [

    # ── Macroeconomics (10) ──────────────────────────────────────────────────
    {"q": "What is the current Federal Reserve monetary policy stance?",            "cat": "macro",   "expect_tool": False},
    {"q": "How does CPI inflation data affect Federal Reserve rate decisions?",     "cat": "macro",   "expect_tool": False},
    {"q": "What does a yield curve inversion historically signal?",                 "cat": "macro",   "expect_tool": False},
    {"q": "What is the relationship between GDP growth and equity market returns?", "cat": "macro",   "expect_tool": False},
    {"q": "How does the Federal Funds Rate affect mortgage rates?",                 "cat": "macro",   "expect_tool": False},
    {"q": "What sectors typically outperform during a recession?",                  "cat": "macro",   "expect_tool": False},
    {"q": "How does a strong US dollar impact multinational company earnings?",     "cat": "macro",   "expect_tool": False},
    {"q": "What is the relationship between unemployment rate and consumer spending?","cat": "macro",  "expect_tool": False},
    {"q": "How does quantitative easing affect equity valuations?",                 "cat": "macro",   "expect_tool": False},
    {"q": "What macro indicators signal a stagflation environment?",                "cat": "macro",   "expect_tool": False},

    # ── Company Analysis (10) ─────────────────────────────────────────────────
    {"q": "What has been NVDA stock performance over the last month?",              "cat": "company", "expect_tool": False},
    {"q": "What are the main revenue drivers for Microsoft?",                       "cat": "company", "expect_tool": False},
    {"q": "How has Apple's gross margin trended recently?",                         "cat": "company", "expect_tool": False},
    {"q": "What is the competitive positioning of Google in cloud computing?",      "cat": "company", "expect_tool": False},
    {"q": "How does Tesla's delivery growth compare to production growth?",         "cat": "company", "expect_tool": False},
    {"q": "What is JPMorgan's exposure to commercial real estate loans?",           "cat": "company", "expect_tool": False},
    {"q": "How has Meta's advertising revenue recovered after 2022?",               "cat": "company", "expect_tool": False},
    {"q": "What is Goldman Sachs' primary revenue segment?",                        "cat": "company", "expect_tool": False},
    {"q": "How does Amazon's AWS margin compare to its retail segment?",            "cat": "company", "expect_tool": False},
    {"q": "What is NVIDIA's data center revenue as a share of total revenue?",      "cat": "company", "expect_tool": False},

    # ── Valuation and Tools (10) ──────────────────────────────────────────────
    {"q": "Calculate the expected return for AAPL using CAPM with a beta of 1.2",  "cat": "valuation","expect_tool": True},
    {"q": "Run a DCF on NVDA assuming FCF grows at 20% for 5 years and WACC is 10%","cat":"valuation","expect_tool": True},
    {"q": "What is the Sharpe ratio for a portfolio returning 14% with 18% vol and 4.5% risk free rate?","cat":"valuation","expect_tool": True},
    {"q": "Price a 10-year bond with 5% coupon and 6% yield to maturity",          "cat": "valuation","expect_tool": True},
    {"q": "Calculate WACC for a company with 80% equity at 10% cost and 20% debt at 4% pre-tax with 21% tax","cat":"valuation","expect_tool": True},
    {"q": "What is the VaR for a $1M portfolio with 20% annual vol at 95% confidence?","cat":"valuation","expect_tool": True},
    {"q": "Calculate fair value for MSFT using P/E if EPS is $11.50 and peer P/E is 28","cat":"valuation","expect_tool": True},
    {"q": "Run DDM for a stock paying $3.20 dividend growing at 4% with 9% required return","cat":"valuation","expect_tool": True},
    {"q": "What is the modified duration for a 5-year bond with 4% coupon at 5% yield?","cat":"valuation","expect_tool": True},
    {"q": "Calculate portfolio return and volatility for 60% AAPL and 40% MSFT given returns of 18% and 14% and vols of 25% and 20%","cat":"valuation","expect_tool": True},

    # ── Market Structure (10) ────────────────────────────────────────────────
    {"q": "How do earnings surprises typically affect stock prices?",               "cat": "market",  "expect_tool": False},
    {"q": "What is the relationship between bond prices and interest rates?",       "cat": "market",  "expect_tool": False},
    {"q": "How does short interest affect stock price momentum?",                   "cat": "market",  "expect_tool": False},
    {"q": "What is the VIX and how does it relate to market volatility?",           "cat": "market",  "expect_tool": False},
    {"q": "How do options expiration dates affect underlying stock volatility?",    "cat": "market",  "expect_tool": False},
    {"q": "What is the difference between systematic and idiosyncratic risk?",      "cat": "market",  "expect_tool": False},
    {"q": "How does insider buying typically signal future stock performance?",     "cat": "market",  "expect_tool": False},
    {"q": "What is the January effect and does it still hold?",                     "cat": "market",  "expect_tool": False},
    {"q": "How do stock splits affect share price and market cap?",                 "cat": "market",  "expect_tool": False},
    {"q": "What is mean reversion and how does it apply to equity markets?",        "cat": "market",  "expect_tool": False},

    # ── Risk and Portfolio (5) ────────────────────────────────────────────────
    {"q": "What macro indicators suggest about recession risk right now?",          "cat": "risk",    "expect_tool": False},
    {"q": "How should a portfolio be positioned for a rising rate environment?",   "cat": "risk",    "expect_tool": False},
    {"q": "What is the difference between credit risk and market risk?",           "cat": "risk",    "expect_tool": False},
    {"q": "How does geopolitical risk affect commodity prices?",                    "cat": "risk",    "expect_tool": False},
    {"q": "What is tail risk and how can it be hedged?",                            "cat": "risk",    "expect_tool": False},

    # ── Comparison (5) ────────────────────────────────────────────────────────
    {"q": "Compare MSFT and GOOGL recent stock performance",                        "cat": "compare", "expect_tool": False},
    {"q": "Which has better risk-adjusted returns, growth or value stocks historically?","cat":"compare","expect_tool": False},
    {"q": "Compare the business models of JPMorgan and Goldman Sachs",              "cat": "compare", "expect_tool": False},
    {"q": "How does NVDA valuation compare to AMD on a P/E basis?",                 "cat": "compare", "expect_tool": False},
    {"q": "Compare the dividend yield of tech stocks versus utility stocks",        "cat": "compare", "expect_tool": False},
]


def get_benchmark_questions(n: int = 10, seed: int | None = None) -> List[Dict]:
    """
    Return n questions sampled randomly, ensuring at least one from each category.
    Pass a seed for reproducibility.
    """
    if seed is not None:
        random.seed(seed)

    by_category: Dict[str, List[Dict]] = {}
    for q in QUESTION_BANK:
        cat = q["cat"]
        by_category.setdefault(cat, []).append(q)

    # Guarantee at least one per category
    selected = []
    for cat_questions in by_category.values():
        selected.append(random.choice(cat_questions))

    # Fill remaining slots from the full pool, excluding already selected
    remaining_pool = [q for q in QUESTION_BANK if q not in selected]
    random.shuffle(remaining_pool)
    needed = max(0, n - len(selected))
    selected.extend(remaining_pool[:needed])

    random.shuffle(selected)
    return selected[:n]


def get_full_bank() -> List[Dict]:
    """Return all 50 questions."""
    return QUESTION_BANK.copy()
