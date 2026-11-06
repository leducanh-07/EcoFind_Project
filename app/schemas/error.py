from typing import Any, Dict, Optional, Union
from pydantic import BaseModel, ConfigDict
from pydantic.alias_generators import to_camel


class ErrorDetail(BaseModel):
    code: Union[int, str]
    message: str
    fields: Optional[Dict[str, Any]] = None

    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
    )


class ErrorResponse(BaseModel):
    error: ErrorDetail

    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
    )
