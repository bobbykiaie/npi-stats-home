import sys
import json
import numpy as np
from scipy.stats import anderson, norm

try:
    # Read JSON input from Node.js
    data = json.loads(sys.stdin.read())
    values = np.array([float(v) for v in data["values"] if v is not None and not isinstance(v, (str, bool))])
    if len(values) < 2:
        raise ValueError("Insufficient data for Q-Q plot and Anderson-Darling test")

    values.sort()

    # Perform Anderson-Darling test
    result = anderson(values, dist='norm')
    statistic = result.statistic
    critical_values = result.critical_values
    significance_levels = result.significance_level
    is_normal = statistic < critical_values[2]
    normality = "Likely Normal" if is_normal else "Likely Not Normal"

    # Calculate Q-Q plot data
    n = len(values)
    sample_quantiles = values  # Already sorted NumPy array
    theoretical_quantiles = norm.ppf(np.linspace(1/(n+1), n/(n+1), n))

    # Return result as JSON with quantile data
    print(json.dumps({
        "anderson_darling_statistic": statistic,
        "critical_values": critical_values.tolist(),
        "significance_levels": significance_levels.tolist(),
        "anderson_darling_p_value": 1.0 if is_normal else 0.0,
        "normality": normality,
        "qq_plot_data": {
            "sample_quantiles": sample_quantiles.tolist(),
            "theoretical_quantiles": theoretical_quantiles.tolist()
        }
    }))

except Exception as e:
    print(json.dumps({"error": str(e)}))
    sys.exit(1)