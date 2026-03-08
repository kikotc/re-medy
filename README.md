# 💜 re-medy
### BACSA Hackss 2026 Open Stream Submission.

## What is re-medy?
Preventable adversses drugs events **(ADEs)** cost the healthcare industry billions each year, causing not only financial damage but also patient harm. Polypharmacy- taking multiple medication at once- is incredibly common, yet patients are largely left to manage complex scheduling, and possibly dangerous drug-to-drug interactions in their own.
re-medy is a scalable support engine which doesn't just track pils; it actively intercepts duplicate ingredients, blocks major drug conflict, and acts as an intelligent 3rd party monitoring for adverse side effects.

## Core Features
### 📷 **Image Auto-parse**
Users bypass tedious manual entry, by snapping or uploading a photo of their medication, they system parses the data finding the exact dosage, active ingredients, and instructions.
### ✨** Gemini-powered Conflict Engine**
Before a medication is saved to the user's calendar, the backend cross-references its pharmacological profile against all other saved medications. Creates a confidence score regarding the usage of each drug combination, reaching certain thresholds will be warned.
### ⏰ **Smart Schedulining**
If there is a minor-moderate drug confidence score, it doesn't just throw a warning. The Agentic organizer automatically computes a safe ``ScheduleSuggestion``, dynamically shifting the dosage times to safely seperate the medication. Major Conflicts will be hard-blocked.
### 🔍** Adverse Drug Reaction Analysis**
When a user feels unwell after administering a drug, they make log a new symptom, the system synthesizes their active schedule, recent ledger history, and known-side effect rules to rank the most staistically likely "culpript".

## ✨ **Gemini**
re-medy is powered by Gemini's 2.5 Flash. It operates as a core Python microsesrvice that outputs JSON contracts to prevent medical hallucinations and unecessary data.
- **Vision-to-JSON Pipeline**: We use Gemini's multimodal image analysis to scan physical pill bottles, drug images and labels. It instantly extracts messy, real-world data directly into our backend's rigied ``ParsedMedicationCondidate`` JSON schema.
- **Grounded Triage: ** Instead of letting the AI guess, we feed Gemini our ``side_effect_rules`` database alongside the user's active medical ledger. This forces the 2.5 Flash model to rank side-effect culprits based strictly on real data.

# ⚙️** Tech Stack**
### Frontend: Next.js / React / TypeScript
### Backend: FastAPI (Python)
### Database: Supabase / Postgres
Thank you BACSA hacks for hosting this amazing Hackathon, can't wait to run it back next year.
                                                                                                                                                                             
            +++++++++++++                                                                                                                                                    
           +++++++++++++++++                                                                                                                                                 
           +++++++++++++++++++    %##%%%%%%                                                                                                                                  
          ##+++++       ++++++*####%%%%%%%%%%%                                                                                                                               
        ####+++++        +++++###%#%%%%%%%%%%%%%                                                                                                                             
       #####+++++        +++++##%%         %%%%%%                                                                                                 +++                        
      #####++++++        +++++##             %%%%%                                                                                                +++                        
     ##### ++++++++++++++++++#                %%%%%                                                                                               +++                        
     ##### +++++++++++++++++                  %%%%%   +++ +++++      ++++++                   +++ +++++    ++++++         +++++++         ++++++  +++ +++        +++         
     ##### ++++++++++++++++                   %%%%%   ++++++++++  ++++++++++++                ++++++++++++++++++++     ++++++++++++     +++++++++++++ ++++      ++++         
     ######++++++     +++++++                %%%%%%   ++++       ++++      ++++               ++++     ++++    ++++   ++++       +++   +++      +++++  ++++     +++          
      ######+++++       ++++++              %%%%%%    +++       ++++        +++ ++++++++++    +++      +++      +++   +++        +++  +++        ++++   +++++  +++           
       ######++++        +++++++          %%%%%%%     +++       ++++++++++++++  ++++++++++    +++      +++      ++++  +++++++++++++   +++        ++++     ++++++++           
         ######*+         +++++++       %%%%%%%       +++        +++                          +++      +++      ++++  +++             ++++       ++++      ++++++            
           ######           ++++++     %%%%%%         +++         ++++     +++                +++      +++      ++++   ++++     +++    +++++  +++++++       ++++             
             ###%%%          +++++++ %%%%%%           +++          +++++++++++                +++      +++      +++     +++++++++++      ++++++++ +++      =+++              
              %%%%%%%         *++++#%%%%%%                                                                                                                 +++               
                %%%%%%%         +*%%%%%%                                                                                                                  +++                
                  %%%%%%%      %%%%%%%                                                                                                                   ++++                
                    %%%%%%%  %%%%%%%                                                                                                                                         
                      %%%%%%%%%%%%                                                                                                                                           
                        %%%%%%%%                                                                                                                                             
                          %%%%%                                                                                                                                              
                           %%                                                                                                                                                
                                                                                                                                                                             
