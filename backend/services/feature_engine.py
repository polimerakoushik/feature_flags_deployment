class FeatureEngine:
    def evaluate(self, flag_key: str, context: dict):
        return {"flag": flag_key, "enabled": True, "context": context}
