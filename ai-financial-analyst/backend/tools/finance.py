"""
Financial Calculation Tools
A library of quantitative finance functions the analyst can call.
Each function takes simple inputs and returns a structured result dict.
"""
import math
from typing import List, Optional


# ── Valuation ─────────────────────────────────────────────────────────────────

def dcf(
    free_cash_flows: List[float],
    terminal_growth_rate: float,
    discount_rate: float,
    shares_outstanding: Optional[float] = None,
) -> dict:
    """
    Discounted Cash Flow valuation.

    Args:
        free_cash_flows:     Projected FCF for each year (list of floats, in millions)
        terminal_growth_rate: Perpetuity growth rate for terminal value (e.g. 0.03 = 3%)
        discount_rate:        WACC or required return (e.g. 0.10 = 10%)
        shares_outstanding:   Shares in millions for per-share value (optional)

    Returns:
        dict with PV of cash flows, terminal value, total enterprise value, and per-share value
    """
    if discount_rate <= terminal_growth_rate:
        return {"error": "Discount rate must exceed terminal growth rate"}

    pv_fcfs = []
    for i, fcf in enumerate(free_cash_flows, 1):
        pv = fcf / (1 + discount_rate) ** i
        pv_fcfs.append(round(pv, 2))

    last_fcf       = free_cash_flows[-1]
    terminal_value = last_fcf * (1 + terminal_growth_rate) / (discount_rate - terminal_growth_rate)
    pv_terminal    = terminal_value / (1 + discount_rate) ** len(free_cash_flows)
    enterprise_value = sum(pv_fcfs) + pv_terminal

    result = {
        "model":              "DCF",
        "pv_of_cash_flows":   round(sum(pv_fcfs), 2),
        "terminal_value":     round(terminal_value, 2),
        "pv_terminal_value":  round(pv_terminal, 2),
        "enterprise_value":   round(enterprise_value, 2),
        "discount_rate":      f"{discount_rate*100:.1f}%",
        "terminal_growth":    f"{terminal_growth_rate*100:.1f}%",
        "yearly_pv_fcfs":     pv_fcfs,
    }

    if shares_outstanding and shares_outstanding > 0:
        result["intrinsic_value_per_share"] = round(enterprise_value / shares_outstanding, 2)

    return result


def ddm(
    current_dividend: float,
    growth_rate: float,
    required_return: float,
) -> dict:
    """
    Gordon Growth / Dividend Discount Model.
    Assumes constant dividend growth in perpetuity.

    Args:
        current_dividend: Most recent annual dividend per share
        growth_rate:      Expected constant growth rate (e.g. 0.04 = 4%)
        required_return:  Required rate of return / cost of equity (e.g. 0.09 = 9%)
    """
    if required_return <= growth_rate:
        return {"error": "Required return must exceed growth rate for stable DDM"}

    next_dividend   = current_dividend * (1 + growth_rate)
    intrinsic_value = next_dividend / (required_return - growth_rate)

    return {
        "model":            "DDM (Gordon Growth)",
        "current_dividend": current_dividend,
        "next_dividend":    round(next_dividend, 4),
        "growth_rate":      f"{growth_rate*100:.1f}%",
        "required_return":  f"{required_return*100:.1f}%",
        "intrinsic_value":  round(intrinsic_value, 2),
    }


def pe_fair_value(
    eps: float,
    peer_pe_ratio: float,
    growth_rate: Optional[float] = None,
) -> dict:
    """
    P/E based fair value and PEG ratio.

    Args:
        eps:           Earnings per share (TTM or forward)
        peer_pe_ratio: Industry or peer average P/E multiple
        growth_rate:   EPS growth rate for PEG calculation (optional, e.g. 0.15 = 15%)
    """
    fair_value = eps * peer_pe_ratio
    result = {
        "model":       "P/E Fair Value",
        "eps":         eps,
        "peer_pe":     peer_pe_ratio,
        "fair_value":  round(fair_value, 2),
    }
    if growth_rate and growth_rate > 0:
        peg = peer_pe_ratio / (growth_rate * 100)
        result["peg_ratio"] = round(peg, 2)
        result["peg_interpretation"] = (
            "Undervalued" if peg < 1 else
            "Fairly valued" if peg < 1.5 else
            "Potentially overvalued"
        )
    return result


def ev_ebitda(
    ebitda: float,
    ev_multiple: float,
    net_debt: float = 0.0,
    shares_outstanding: Optional[float] = None,
) -> dict:
    """
    EV/EBITDA valuation.

    Args:
        ebitda:             EBITDA in millions
        ev_multiple:        Target EV/EBITDA multiple (peer or sector average)
        net_debt:           Net debt in millions (debt minus cash)
        shares_outstanding: Shares in millions for per-share equity value
    """
    enterprise_value = ebitda * ev_multiple
    equity_value     = enterprise_value - net_debt

    result = {
        "model":            "EV/EBITDA",
        "ebitda":           ebitda,
        "ev_multiple":      ev_multiple,
        "enterprise_value": round(enterprise_value, 2),
        "net_debt":         net_debt,
        "equity_value":     round(equity_value, 2),
    }
    if shares_outstanding and shares_outstanding > 0:
        result["value_per_share"] = round(equity_value / shares_outstanding, 2)
    return result


# ── Risk / Return ─────────────────────────────────────────────────────────────

def capm(
    risk_free_rate: float,
    beta: float,
    market_return: float,
) -> dict:
    """
    Capital Asset Pricing Model — expected return.

    Args:
        risk_free_rate: Current risk-free rate (e.g. 0.045 = 4.5% for 10Y Treasury)
        beta:           Stock beta relative to market
        market_return:  Expected market return (e.g. 0.10 = 10% historical S&P average)
    """
    market_risk_premium = market_return - risk_free_rate
    expected_return     = risk_free_rate + beta * market_risk_premium

    return {
        "model":               "CAPM",
        "risk_free_rate":      f"{risk_free_rate*100:.2f}%",
        "beta":                beta,
        "market_return":       f"{market_return*100:.2f}%",
        "market_risk_premium": f"{market_risk_premium*100:.2f}%",
        "expected_return":     f"{expected_return*100:.2f}%",
        "interpretation": (
            f"With a beta of {beta}, this asset is "
            f"{'more' if beta > 1 else 'less'} volatile than the market. "
            f"CAPM implies a required return of {expected_return*100:.2f}%."
        ),
    }


def sharpe_ratio(
    portfolio_return: float,
    risk_free_rate: float,
    portfolio_std_dev: float,
) -> dict:
    """
    Sharpe Ratio — risk-adjusted return.

    Args:
        portfolio_return:  Annualized portfolio return (e.g. 0.12 = 12%)
        risk_free_rate:    Risk-free rate (e.g. 0.045)
        portfolio_std_dev: Annualized standard deviation of returns (e.g. 0.18 = 18%)
    """
    if portfolio_std_dev == 0:
        return {"error": "Standard deviation cannot be zero"}

    excess_return = portfolio_return - risk_free_rate
    ratio         = excess_return / portfolio_std_dev

    return {
        "model":            "Sharpe Ratio",
        "portfolio_return": f"{portfolio_return*100:.2f}%",
        "risk_free_rate":   f"{risk_free_rate*100:.2f}%",
        "excess_return":    f"{excess_return*100:.2f}%",
        "std_deviation":    f"{portfolio_std_dev*100:.2f}%",
        "sharpe_ratio":     round(ratio, 3),
        "interpretation": (
            "Excellent risk-adjusted return" if ratio > 2 else
            "Good risk-adjusted return"       if ratio > 1 else
            "Acceptable risk-adjusted return" if ratio > 0.5 else
            "Poor risk-adjusted return"
        ),
    }


def value_at_risk(
    portfolio_value: float,
    expected_return: float,
    std_dev: float,
    confidence_level: float = 0.95,
    holding_period_days: int = 1,
) -> dict:
    """
    Parametric Value at Risk (VaR) — daily loss at a given confidence level.

    Args:
        portfolio_value:      Total portfolio value in dollars/millions
        expected_return:      Daily expected return (annualized / 252)
        std_dev:              Daily std dev of returns (annualized / sqrt(252))
        confidence_level:     e.g. 0.95 or 0.99
        holding_period_days:  Holding period in days
    """
    # Z-scores for common confidence levels
    z_scores = {0.90: 1.282, 0.95: 1.645, 0.99: 2.326, 0.999: 3.090}
    z = z_scores.get(confidence_level, 1.645)

    daily_std    = std_dev / math.sqrt(252)
    daily_mean   = expected_return / 252
    period_std   = daily_std * math.sqrt(holding_period_days)
    period_mean  = daily_mean * holding_period_days

    var_pct  = -(period_mean - z * period_std)
    var_abs  = var_pct * portfolio_value

    return {
        "model":             "Parametric VaR",
        "portfolio_value":   portfolio_value,
        "confidence_level":  f"{confidence_level*100:.0f}%",
        "holding_period":    f"{holding_period_days} day(s)",
        "var_percentage":    f"{var_pct*100:.2f}%",
        "var_dollar":        round(var_abs, 2),
        "interpretation":    f"With {confidence_level*100:.0f}% confidence, maximum loss over {holding_period_days} day(s) is ${var_abs:,.2f} ({var_pct*100:.2f}% of portfolio).",
    }


# ── Fixed Income ──────────────────────────────────────────────────────────────

def bond_price(
    face_value: float,
    coupon_rate: float,
    yield_to_maturity: float,
    years_to_maturity: float,
    payments_per_year: int = 2,
) -> dict:
    """
    Bond pricing — present value of all cash flows.

    Args:
        face_value:         Par value (e.g. 1000)
        coupon_rate:        Annual coupon rate (e.g. 0.05 = 5%)
        yield_to_maturity:  Required yield (e.g. 0.06 = 6%)
        years_to_maturity:  Time to maturity in years
        payments_per_year:  Coupon payments per year (2 = semi-annual)
    """
    periods         = int(years_to_maturity * payments_per_year)
    period_yield    = yield_to_maturity / payments_per_year
    coupon_payment  = face_value * coupon_rate / payments_per_year

    pv_coupons = coupon_payment * (1 - (1 + period_yield) ** -periods) / period_yield
    pv_face    = face_value / (1 + period_yield) ** periods
    price      = pv_coupons + pv_face

    return {
        "model":            "Bond Pricing",
        "face_value":       face_value,
        "coupon_rate":      f"{coupon_rate*100:.2f}%",
        "yield_to_maturity":f"{yield_to_maturity*100:.2f}%",
        "years_to_maturity":years_to_maturity,
        "bond_price":       round(price, 4),
        "premium_discount": "At premium" if price > face_value else "At discount" if price < face_value else "At par",
        "price_pct_of_par": f"{price/face_value*100:.2f}%",
    }


def duration(
    face_value: float,
    coupon_rate: float,
    yield_to_maturity: float,
    years_to_maturity: float,
    payments_per_year: int = 2,
) -> dict:
    """
    Macaulay and Modified Duration — interest rate sensitivity.
    """
    periods        = int(years_to_maturity * payments_per_year)
    period_yield   = yield_to_maturity / payments_per_year
    coupon_payment = face_value * coupon_rate / payments_per_year

    # Calculate bond price
    pv_coupons = coupon_payment * (1 - (1 + period_yield) ** -periods) / period_yield
    pv_face    = face_value / (1 + period_yield) ** periods
    price      = pv_coupons + pv_face

    # Macaulay duration
    weighted_time = 0.0
    for t in range(1, periods + 1):
        cf        = coupon_payment if t < periods else coupon_payment + face_value
        pv_cf     = cf / (1 + period_yield) ** t
        weighted_time += (t / payments_per_year) * pv_cf

    macaulay_duration = weighted_time / price
    modified_duration = macaulay_duration / (1 + period_yield)

    return {
        "model":             "Duration",
        "macaulay_duration": round(macaulay_duration, 4),
        "modified_duration": round(modified_duration, 4),
        "interpretation":    f"A 1% rise in yields would decrease the bond price by approximately {modified_duration:.2f}%.",
    }


# ── Portfolio Analytics ────────────────────────────────────────────────────────

def portfolio_metrics(
    weights: List[float],
    expected_returns: List[float],
    std_devs: List[float],
    correlations: Optional[List[List[float]]] = None,
) -> dict:
    """
    Portfolio expected return and volatility.

    Args:
        weights:          Asset weights (must sum to 1.0)
        expected_returns: Expected return per asset (annualized)
        std_devs:         Standard deviation per asset (annualized)
        correlations:     Correlation matrix (n x n). If None, assumes zero correlation.
    """
    n = len(weights)
    if not (n == len(expected_returns) == len(std_devs)):
        return {"error": "Weights, returns, and std_devs must have the same length"}

    total_weight = sum(weights)
    if abs(total_weight - 1.0) > 0.01:
        return {"error": f"Weights must sum to 1.0 (currently {total_weight:.2f})"}

    # Portfolio return
    port_return = sum(w * r for w, r in zip(weights, expected_returns))

    # Portfolio variance
    port_variance = 0.0
    for i in range(n):
        for j in range(n):
            corr = correlations[i][j] if correlations else (1.0 if i == j else 0.0)
            port_variance += weights[i] * weights[j] * std_devs[i] * std_devs[j] * corr

    port_std_dev = math.sqrt(port_variance)

    return {
        "model":                  "Portfolio Metrics",
        "portfolio_return":       f"{port_return*100:.2f}%",
        "portfolio_volatility":   f"{port_std_dev*100:.2f}%",
        "portfolio_variance":     round(port_variance, 6),
        "asset_weights":          [f"{w*100:.1f}%" for w in weights],
        "asset_returns":          [f"{r*100:.1f}%" for r in expected_returns],
        "diversification_ratio":  round(sum(w*s for w,s in zip(weights,std_devs)) / port_std_dev, 3),
    }


def wacc(
    equity_value: float,
    debt_value: float,
    cost_of_equity: float,
    cost_of_debt: float,
    tax_rate: float,
) -> dict:
    """
    Weighted Average Cost of Capital.

    Args:
        equity_value:   Market cap in millions
        debt_value:     Total debt in millions
        cost_of_equity: Required return on equity (from CAPM, e.g. 0.10)
        cost_of_debt:   Pre-tax cost of debt (e.g. 0.05)
        tax_rate:       Corporate tax rate (e.g. 0.21)
    """
    total      = equity_value + debt_value
    w_equity   = equity_value / total
    w_debt     = debt_value   / total
    wacc_value = w_equity * cost_of_equity + w_debt * cost_of_debt * (1 - tax_rate)

    return {
        "model":           "WACC",
        "equity_weight":   f"{w_equity*100:.1f}%",
        "debt_weight":     f"{w_debt*100:.1f}%",
        "cost_of_equity":  f"{cost_of_equity*100:.2f}%",
        "after_tax_cost_of_debt": f"{cost_of_debt*(1-tax_rate)*100:.2f}%",
        "wacc":            f"{wacc_value*100:.2f}%",
        "interpretation":  f"The company must earn at least {wacc_value*100:.2f}% return on invested capital to create value.",
    }


# ── Tool Registry ─────────────────────────────────────────────────────────────
# Used by routes.py to expose tools to Claude via the Anthropic tool-use API.

TOOL_DEFINITIONS = [
    {
        "name": "dcf_valuation",
        "description": "Discounted Cash Flow valuation. Use when asked to value a company based on projected free cash flows.",
        "input_schema": {
            "type": "object",
            "properties": {
                "free_cash_flows":     {"type": "array",  "items": {"type": "number"}, "description": "Projected FCF for each year in millions"},
                "terminal_growth_rate":{"type": "number", "description": "Perpetuity growth rate e.g. 0.03 for 3%"},
                "discount_rate":       {"type": "number", "description": "WACC or required return e.g. 0.10 for 10%"},
                "shares_outstanding":  {"type": "number", "description": "Shares outstanding in millions (optional)"},
            },
            "required": ["free_cash_flows", "terminal_growth_rate", "discount_rate"],
        },
    },
    {
        "name": "ddm_valuation",
        "description": "Dividend Discount Model (Gordon Growth). Use when asked to value a dividend-paying stock.",
        "input_schema": {
            "type": "object",
            "properties": {
                "current_dividend": {"type": "number", "description": "Most recent annual dividend per share"},
                "growth_rate":      {"type": "number", "description": "Expected constant dividend growth rate e.g. 0.04"},
                "required_return":  {"type": "number", "description": "Required rate of return e.g. 0.09"},
            },
            "required": ["current_dividend", "growth_rate", "required_return"],
        },
    },
    {
        "name": "capm_expected_return",
        "description": "CAPM — calculate the expected return for a stock given its beta. Use when asked about required return or cost of equity.",
        "input_schema": {
            "type": "object",
            "properties": {
                "risk_free_rate": {"type": "number", "description": "Current risk-free rate e.g. 0.045 for 4.5%"},
                "beta":           {"type": "number", "description": "Stock beta relative to market"},
                "market_return":  {"type": "number", "description": "Expected market return e.g. 0.10"},
            },
            "required": ["risk_free_rate", "beta", "market_return"],
        },
    },
    {
        "name": "sharpe_ratio",
        "description": "Calculate the Sharpe Ratio for a portfolio or investment.",
        "input_schema": {
            "type": "object",
            "properties": {
                "portfolio_return":  {"type": "number", "description": "Annualized portfolio return e.g. 0.12"},
                "risk_free_rate":    {"type": "number", "description": "Risk-free rate e.g. 0.045"},
                "portfolio_std_dev": {"type": "number", "description": "Annualized standard deviation e.g. 0.18"},
            },
            "required": ["portfolio_return", "risk_free_rate", "portfolio_std_dev"],
        },
    },
    {
        "name": "bond_price",
        "description": "Price a bond given its coupon rate and yield to maturity.",
        "input_schema": {
            "type": "object",
            "properties": {
                "face_value":          {"type": "number", "description": "Par value e.g. 1000"},
                "coupon_rate":         {"type": "number", "description": "Annual coupon rate e.g. 0.05"},
                "yield_to_maturity":   {"type": "number", "description": "Required yield e.g. 0.06"},
                "years_to_maturity":   {"type": "number", "description": "Years to maturity"},
                "payments_per_year":   {"type": "number", "description": "Coupon frequency, 2 for semi-annual"},
            },
            "required": ["face_value", "coupon_rate", "yield_to_maturity", "years_to_maturity"],
        },
    },
    {
        "name": "value_at_risk",
        "description": "Calculate parametric Value at Risk (VaR) for a portfolio.",
        "input_schema": {
            "type": "object",
            "properties": {
                "portfolio_value":      {"type": "number", "description": "Total portfolio value in dollars"},
                "expected_return":      {"type": "number", "description": "Annualized expected return e.g. 0.10"},
                "std_dev":              {"type": "number", "description": "Annualized standard deviation e.g. 0.20"},
                "confidence_level":     {"type": "number", "description": "Confidence level e.g. 0.95"},
                "holding_period_days":  {"type": "number", "description": "Holding period in days e.g. 1"},
            },
            "required": ["portfolio_value", "expected_return", "std_dev"],
        },
    },
    {
        "name": "wacc_calculation",
        "description": "Calculate Weighted Average Cost of Capital (WACC).",
        "input_schema": {
            "type": "object",
            "properties": {
                "equity_value":    {"type": "number", "description": "Market cap in millions"},
                "debt_value":      {"type": "number", "description": "Total debt in millions"},
                "cost_of_equity":  {"type": "number", "description": "Required return on equity e.g. 0.10"},
                "cost_of_debt":    {"type": "number", "description": "Pre-tax cost of debt e.g. 0.05"},
                "tax_rate":        {"type": "number", "description": "Corporate tax rate e.g. 0.21"},
            },
            "required": ["equity_value", "debt_value", "cost_of_equity", "cost_of_debt", "tax_rate"],
        },
    },
    {
        "name": "pe_fair_value",
        "description": "Calculate fair value using P/E multiple and compute PEG ratio.",
        "input_schema": {
            "type": "object",
            "properties": {
                "eps":            {"type": "number", "description": "Earnings per share"},
                "peer_pe_ratio":  {"type": "number", "description": "Peer/industry average P/E"},
                "growth_rate":    {"type": "number", "description": "EPS growth rate for PEG e.g. 0.15"},
            },
            "required": ["eps", "peer_pe_ratio"],
        },
    },
    {
        "name": "portfolio_metrics",
        "description": "Calculate portfolio expected return and volatility given asset weights.",
        "input_schema": {
            "type": "object",
            "properties": {
                "weights":          {"type": "array", "items": {"type": "number"}, "description": "Asset weights summing to 1.0"},
                "expected_returns": {"type": "array", "items": {"type": "number"}, "description": "Expected return per asset"},
                "std_devs":         {"type": "array", "items": {"type": "number"}, "description": "Std deviation per asset"},
            },
            "required": ["weights", "expected_returns", "std_devs"],
        },
    },
]


# In-memory tool call log — visible at /api/v1/tools/log
tool_call_log: list[dict] = []


def run_tool(tool_name: str, inputs: dict) -> dict:
    """Dispatch a tool call by name, log it, and return the result."""
    from datetime import datetime

    dispatch = {
        "dcf_valuation":       lambda i: dcf(**i),
        "ddm_valuation":       lambda i: ddm(**i),
        "capm_expected_return":lambda i: capm(**i),
        "sharpe_ratio":        lambda i: sharpe_ratio(**i),
        "bond_price":          lambda i: bond_price(**i),
        "value_at_risk":       lambda i: value_at_risk(**i),
        "wacc_calculation":    lambda i: wacc(**i),
        "pe_fair_value":       lambda i: pe_fair_value(**i),
        "portfolio_metrics":   lambda i: portfolio_metrics(**i),
    }

    fn = dispatch.get(tool_name)
    if not fn:
        entry = {"tool": tool_name, "inputs": inputs, "result": {"error": f"Unknown tool: {tool_name}"}, "timestamp": datetime.utcnow().isoformat(), "success": False}
        tool_call_log.append(entry)
        print(f"[tool] UNKNOWN: {tool_name}")
        return entry["result"]

    try:
        result = fn(inputs)
        entry  = {"tool": tool_name, "inputs": inputs, "result": result, "timestamp": datetime.utcnow().isoformat(), "success": True}
        tool_call_log.append(entry)
        if len(tool_call_log) > 200:
            tool_call_log.pop(0)
        # Print to terminal so you can see it live
        print(f"[tool] {tool_name} called")
        print(f"[tool]   inputs: {inputs}")
        print(f"[tool]   result: {result}")
        return result
    except TypeError as e:
        entry = {"tool": tool_name, "inputs": inputs, "result": {"error": str(e)}, "timestamp": datetime.utcnow().isoformat(), "success": False}
        tool_call_log.append(entry)
        print(f"[tool] ERROR in {tool_name}: {e}")
        return entry["result"]
