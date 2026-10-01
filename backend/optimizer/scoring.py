"""
Optimization Scoring Module
Computes a transparent, multi-criteria optimization score (0-100)
evaluating Reliability, Renewable Contribution, Diesel Reduction, Resource Utilization, and Overcapacity.
"""

from typing import Dict, Any

def calculate_optimization_score(
    renewable_fraction: float,       # 0.0 to 1.0 (e.g. 0.88 for 88%)
    unmet_fraction: float,           # 0.0 to 1.0 (fraction of demand unserved)
    diesel_reduction_ratio: float,   # 0.0 to 1.0 (e.g. 0.85 for 85% diesel reduction)
    curtailment_fraction: float,     # 0.0 to 1.0 (curtailed energy / total gen)
    total_installed_capacity_kw: float,
    peak_demand_kw: float
) -> Dict[str, Any]:
    """
    Computes transparent multi-criteria optimization score:
    Score = Reliability + Renewable Contribution + Diesel Reduction + Resource Utilization - Overcapacity Penalty
    Max Score: 100 points
    """
    # 1. Reliability Score (Max 30 points)
    # 0% unmet load = full 30 points. Strict penalty for power cuts.
    loss_of_load = max(0.0, min(1.0, unmet_fraction))
    reliability_score = round(30.0 * (1.0 - (loss_of_load * 10.0)), 1)
    reliability_score = max(0.0, min(30.0, reliability_score))

    # 2. Renewable Contribution Score (Max 30 points)
    # Direct reward for clean energy generation
    ren_fraction = max(0.0, min(1.0, renewable_fraction))
    renewable_score = round(30.0 * ren_fraction, 1)

    # 3. Diesel Reduction Score (Max 25 points)
    # Direct reward for eliminating dirty fossil fuel consumption
    diesel_ratio = max(0.0, min(1.0, diesel_reduction_ratio))
    diesel_score = round(25.0 * diesel_ratio, 1)

    # 4. Resource Utilization Score (Max 15 points)
    # Rewards efficient sizing without excessive dumped/curtailed energy
    curt_ratio = max(0.0, min(1.0, curtailment_fraction))
    utilization_score = round(15.0 * (1.0 - curt_ratio * 1.5), 1)
    utilization_score = max(0.0, min(15.0, utilization_score))

    # 5. Overcapacity Penalty (Max 15 points deduction)
    # Penalizes installing excessive redundant capacity that drives up island CAPEX
    oversizing_factor = total_installed_capacity_kw / peak_demand_kw if peak_demand_kw > 0 else 1.0
    if oversizing_factor > 2.8:
        excess = oversizing_factor - 2.8
        penalty = min(15.0, excess * 4.0)
    else:
        penalty = 0.0
    overcapacity_penalty = round(penalty, 1)

    total_score = round(reliability_score + renewable_score + diesel_score + utilization_score - overcapacity_penalty, 1)
    total_score = max(0.0, min(100.0, total_score))

    # Performance tier label
    if total_score >= 90.0:
        grade = "Optimal (Tier 1)"
        assessment = "Exceptional energy balance with near-zero diesel dependency, minimal curtailment, and resilient reliability."
    elif total_score >= 75.0:
        grade = "High Efficiency (Tier 2)"
        assessment = "Strong renewable displacement meeting island sustainability targets with sensible capital deployment."
    elif total_score >= 60.0:
        grade = "Moderate (Tier 3)"
        assessment = "Good carbon reduction, but additional battery storage or baseload OTEC is recommended to displace residual diesel."
    else:
        grade = "Sub-Optimal (Tier 4)"
        assessment = "High reliance on diesel generators or notable curtailment. Configuration needs re-balancing."

    formula_explanation = (
        f"Score = Reliability ({reliability_score}/30) + Renewable Share ({renewable_score}/30) + "
        f"Diesel Reduction ({diesel_score}/25) + Resource Efficiency ({utilization_score}/15) - "
        f"Overcapacity Penalty (-{overcapacity_penalty}/15) = {total_score}/100"
    )

    return {
        "total_score": total_score,
        "grade": grade,
        "assessment": assessment,
        "formula_explanation": formula_explanation,
        "breakdown": {
            "reliability_score": reliability_score,
            "max_reliability": 30.0,
            "renewable_score": renewable_score,
            "max_renewable": 30.0,
            "diesel_reduction_score": diesel_score,
            "max_diesel_reduction": 25.0,
            "resource_utilization_score": utilization_score,
            "max_resource_utilization": 15.0,
            "overcapacity_penalty": overcapacity_penalty,
            "max_overcapacity_penalty": 15.0
        }
    }
