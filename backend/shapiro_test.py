import sys
import json
import numpy as np
from scipy.stats import shapiro, norm

try:
    # Read JSON input from Node.js
    data = json.loads(sys.stdin.read())
    print(f"Received data: {data}", file=sys.stderr)  # Log input to stderr for debugging

    # Extract and validate numerical values as NumPy array
    values = np.array([float(v) for v in data["values"] if v is not None and not isinstance(v, (str, bool))])
    print(f"Validated values: {values}", file=sys.stderr)  # Log validated values
    if len(values) < 3:  # Shapiro-Wilk requires at least 3 values for reliable results
        raise ValueError("Insufficient data for Shapiro-Wilk test and Q-Q plot (minimum 3 values required)")

    # Sort values for Q-Q plot
    values.sort()
    print(f"Sorted values: {values}", file=sys.stderr)  # Log sorted values

    # Scale small values to avoid numerical instability
    scale_factor = 1000 if np.all(values < 0.01) else 1
    scaled_values = values * scale_factor
    print(f"Scaled values (factor {scale_factor}): {scaled_values}", file=sys.stderr)

    # Perform Shapiro-Wilk test
    try:
        statistic, p_value = shapiro(scaled_values)
    except Exception as e:
        print(f"Shapiro-Wilk test failed: {str(e)}", file=sys.stderr)
        raise ValueError(f"Shapiro-Wilk test error: {str(e)}")

    print(f"Shapiro-Wilk statistic: {statistic}, p-value: {p_value}", file=sys.stderr)  # Log test results

    # Determine normality
    normality = "Likely Normal" if p_value > 0.05 else "Likely Not Normal"

    # Calculate Q-Q plot data (scale back for plotting)
    n = len(values)
    sample_quantiles = scaled_values / scale_factor  # Scale back to original scale as NumPy array
    theoretical_quantiles = norm.ppf(np.linspace(1/(n+1), n/(n+1), n))  # NumPy array
    print(f"Q-Q plot data - Sample: {sample_quantiles}, Theoretical: {theoretical_quantiles}", file=sys.stderr)  # Log Q-Q data

    # Return result as JSON with quantile data (no .tolist() for lists)
    print(json.dumps({
        "shapiro_wilk_statistic": float(statistic),
        "shapiro_wilk_p_value": float(p_value),
        "normality": normality,
        "qq_plot_data": {
            "sample_quantiles": sample_quantiles.tolist(),  # Use .tolist() for NumPy array
            "theoretical_quantiles": theoretical_quantiles.tolist()  # Use .tolist() for NumPy array
        }
    }))

except Exception as e:
    print(f"Error in Shapiro-Wilk: {str(e)}", file=sys.stderr)  # Log error to stderr
    print(json.dumps({"error": str(e)}))
    sys.exit(1)