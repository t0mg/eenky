/*
	Determines the type of a generic ink variable. By @IFcoltransG on the inkle discord.


	Usage: 

	VAR x = "Hello!"
	VAR y = 14 
	LIST z = (Hat), (Coat)

	{type_of(x) == Number:
		This is a number, so it's safe to divide it by 2. 
		{x / 2}
	} 
	
		
*/


LIST Type = List, String, Number, Bool
=== function type_of(val)
    {"{val + val}":
        - "{val}{val}":
            {val ? val:
                ~ return String
            - else: 
                ~ return List // empty
            }
            
        - "{val}":
            { "{val}" == "0":
                ~ return Number // zero
            - else: 
                ~ return List
            }
         
        - else:
            {"{not not val}" == "{val}":
                ~ return Bool 
            }
            ~ return Number
    }